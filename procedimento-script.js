import { database } from './firebase-config.js';
import { ref, set, get, push, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const atendimento = urlParams.get("atendimento");
const addProcForm = document.getElementById("addProcForm");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const removerBtn = document.getElementById("removerBtn");

function gerarCabecalho() {
  tableHead.innerHTML = '<th>Procedimento</th>';
  for (let i = 0; i < 24; i++) {
    const th = document.createElement("th");
    th.textContent = `${i.toString().padStart(2, '0')}:00`;
    tableHead.appendChild(th);
  }
}

async function carregarProcedimentos() {
  tableBody.innerHTML = "";
  const dataHoje = new Date().toISOString().split('T')[0];

  const [procSnap, checkSnap] = await Promise.all([
    get(ref(database, `procedimentos/${atendimento}`)),
    get(ref(database, `checagens_proc/${atendimento}/${dataHoje}`))
  ]);

  if (!procSnap.exists()) {
    tableBody.innerHTML = '<tr><td colspan="25">Nenhum procedimento cadastrado</td></tr>';
    return;
  }

  const procedimentos = procSnap.val();
  const checagens = checkSnap.exists() ? checkSnap.val() : {};

  Object.entries(procedimentos).forEach(([key, proc]) => {
    const tr = document.createElement("tr");
    const tdNome = document.createElement("td");
    tdNome.textContent = proc.nome;
    tr.appendChild(tdNome);

    for (let hora = 0; hora < 24; hora++) {
      const horaFormatada = `${hora.toString().padStart(2, '0')}:00`;
      const td = document.createElement("td");

      if (hora % parseInt(proc.intervalo) === 0) {
        const btn = document.createElement("button");
        btn.className = 'btn btn-sm btn-outline-success';
        btn.innerHTML = '✔';
        btn.dataset.nome = proc.nome;
        btn.dataset.hora = horaFormatada;

        if (checagens[proc.nome]?.[horaFormatada]?.checado) {
          btn.classList.replace('btn-outline-success', 'btn-success');
          btn.innerHTML = '✓';
          btn.classList.add('checked');
        }

        td.appendChild(btn);
      }

      tr.appendChild(td);
    }

    tableBody.appendChild(tr);
  });

  tableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const nome = btn.dataset.nome;
    const hora = btn.dataset.hora;
    const dataHoje = new Date().toISOString().split('T')[0];
    const isChecked = btn.classList.contains('checked');

    if (isChecked) {
      if (confirm(`Deseja reverter a administração de ${nome} às ${hora}?`)) {
        const histRef = ref(database, `historico/${atendimento}`);
        const histSnap = await get(histRef);

        if (histSnap.exists()) {
          const hist = histSnap.val();
          for (const [key, item] of Object.entries(hist)) {
            if (item.medicamento === nome && item.horarioPrevisto === hora && item.data === dataHoje) {
              await remove(ref(database, `historico/${atendimento}/${key}`));
              break;
            }
          }
        }

        await remove(ref(database, `checagens_proc/${atendimento}/${dataHoje}/${nome}/${hora}`));
        btn.classList.replace('btn-success', 'btn-outline-success');
        btn.innerHTML = '✔';
        btn.classList.remove('checked');
      }
    } else {
      if (confirm(`Confirmar administração de ${nome} às ${hora}?`)) {
        const horarioReal = new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });

        await set(ref(database, `checagens_proc/${atendimento}/${dataHoje}/${nome}/${hora}`), {
          checado: true,
          horarioReal
        });

        await push(ref(database, `historico/${atendimento}`), {
          medicamento: nome,
          horarioPrevisto: hora,
          horarioReal,
          data: dataHoje
        });

        btn.classList.replace('btn-outline-success', 'btn-success');
        btn.innerHTML = '✓';
        btn.classList.add('checked');
      }
    }
  });
}

addProcForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeProc").value.trim();
  const intervalo = parseInt(document.getElementById("intervalo").value);

  if (!nome) {
    alert("Informe o nome do procedimento");
    return;
  }

  const snapshot = await get(ref(database, `procedimentos/${atendimento}`));
  if (snapshot.exists()) {
    const procs = snapshot.val();
    const existe = Object.values(procs).some(p => p.nome.toLowerCase() === nome.toLowerCase());
    if (existe) {
      alert("Procedimento já cadastrado");
      return;
    }
  }

  await push(ref(database, `procedimentos/${atendimento}`), { nome, intervalo });

  addProcForm.reset();
  bootstrap.Modal.getInstance(document.getElementById("procModal")).hide();
  carregarProcedimentos();
});

removerBtn.addEventListener("click", async () => {
  const snapshot = await get(ref(database, `procedimentos/${atendimento}`));
  if (!snapshot.exists()) {
    alert("Nenhum procedimento cadastrado");
    return;
  }

  const procedimentos = snapshot.val();
  const nomes = Object.entries(procedimentos);
  const nomeAlvo = prompt("Digite o nome do procedimento a remover:");
  const item = nomes.find(([key, val]) => val.nome.toLowerCase() === nomeAlvo?.toLowerCase());

  if (item) {
    await remove(ref(database, `procedimentos/${atendimento}/${item[0]}`));
    carregarProcedimentos();
  } else {
    alert("Procedimento não encontrado");
  }
});

gerarCabecalho();
carregarProcedimentos();
