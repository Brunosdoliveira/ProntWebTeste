import { database } from '../firebase-config.js';
import { ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const atendimento = urlParams.get("atendimento");
const addMedForm = document.getElementById("addMedForm");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const removerBtn = document.getElementById("removerBtn");

function gerarHorarios(intervalo) {
  const horarios = [];
  const agora = new Date();
  agora.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i += intervalo) {
    const hora = new Date(agora);
    hora.setHours(agora.getHours() + i);
    horarios.push(hora.toTimeString().substring(0, 5));
  }
  return horarios;
}

addMedForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeMed").value.trim();
  const intervalo = parseInt(document.getElementById("intervalo").value);
  const horarios = gerarHorarios(intervalo);

  const dados = { nome, intervalo, horarios };
  await set(ref(database, `pacientes/${atendimento}/medicacoes/${nome}`), dados);

  addMedForm.reset();
  const modal = bootstrap.Modal.getInstance(document.getElementById("medModal"));
  modal.hide();
  carregarTabela();
});

removerBtn.addEventListener("click", async () => {
  const nome = prompt("Digite o nome do medicamento que deseja remover:");
  if (!nome) return;
  await set(ref(database, `pacientes/${atendimento}/medicacoes/${nome}`), null);
  carregarTabela();
});

async function carregarTabela() {
  tableHead.innerHTML = '<th>Medicamento</th>';
  tableBody.innerHTML = "";

  const dataHoje = new Date().toISOString().split('T')[0];
  const snapshot = await get(ref(database, `pacientes/${atendimento}/medicacoes`));

  if (!snapshot.exists()) return;

  const meds = snapshot.val();
  const horarios = new Set();

  Object.values(meds).forEach(m => m.horarios.forEach(h => horarios.add(h)));
  const colunas = Array.from(horarios).sort();

  colunas.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    tableHead.appendChild(th);
  });

  for (const med of Object.values(meds)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${med.nome}</td>`;

    for (const h of colunas) {
      const td = document.createElement("td");
      const refPath = `checagens/${atendimento}/${med.nome}/${dataHoje}/${h}`;
      td.style.cursor = "pointer";

      const snap = await get(ref(database, refPath));
      const dados = snap.val();

      if (dados && dados.checado) {
        td.classList.add("checked");
        td.textContent = "✓";
      }

      td.addEventListener("click", async () => {
        const snapAtual = await get(ref(database, refPath));
        const val = snapAtual.val();

        if (!val || !val.checado) {
          const confirmar = confirm(`Deseja marcar o horário ${h} como administrado?`);
          if (confirmar) {
            const agora = new Date();
            const horarioReal = agora.toTimeString().substring(0, 5);
            const dados = { checado: true, horarioReal };
            await set(ref(database, refPath), dados);
            await set(ref(database, `historico/${atendimento}/${med.nome}_${dataHoje}_${h}`), {
              medicamento: med.nome,
              horarioPrevisto: h,
              horarioReal,
              data: dataHoje
            });
            td.classList.add("checked");
            td.textContent = "✓";
          }
        } else {
          const estornar = confirm(`Deseja estornar o horário ${h}?`);
          if (estornar) {
            await set(ref(database, refPath), null);
            await set(ref(database, `historico/${atendimento}/${med.nome}_${dataHoje}_${h}`), null);
            td.classList.remove("checked");
            td.textContent = "";
          }
        }
      });

      tr.appendChild(td);
    }
    tableBody.appendChild(tr);
  }
}

carregarTabela();
