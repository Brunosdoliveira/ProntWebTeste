import { database } from './firebase-config.js';
import { ref, set, get, push, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const atendimento = urlParams.get("atendimento");
const addMedForm = document.getElementById("addMedForm");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const removerBtn = document.getElementById("removerBtn");

// Gera cabeçalho com horários
function gerarCabecalho() {
  tableHead.innerHTML = '<th>Medicamento</th>';
  for (let i = 0; i < 24; i++) {
    const th = document.createElement("th");
    th.textContent = `${i.toString().padStart(2, '0')}:00`;
    tableHead.appendChild(th);
  }
}

// Carrega medicamentos e status de administração
async function carregarMedicamentos() {
  tableBody.innerHTML = "";
  const dataHoje = new Date().toISOString().split('T')[0];
  
  const [medsSnapshot, checksSnapshot] = await Promise.all([
    get(ref(database, `medicamentos/${atendimento}`)),
    get(ref(database, `checagens/${atendimento}/${dataHoje}`))
  ]);

  if (!medsSnapshot.exists()) {
    tableBody.innerHTML = '<tr><td colspan="25">Nenhum medicamento cadastrado</td></tr>';
    return;
  }

  const medicamentos = medsSnapshot.val();
  const checagens = checksSnapshot.exists() ? checksSnapshot.val() : {};

  Object.entries(medicamentos).forEach(([key, med]) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-key", key);
    
    // Célula do nome do medicamento
    const tdNome = document.createElement("td");
    tdNome.textContent = med.nome;
    tr.appendChild(tdNome);

    // Células dos horários
    for (let hora = 0; hora < 24; hora++) {
      const horaFormatada = `${hora.toString().padStart(2, '0')}:00`;
      const td = document.createElement("td");
      
      if (hora % parseInt(med.intervalo) === 0) {
        const btn = document.createElement("button");
        btn.className = 'btn btn-sm btn-outline-success';
        btn.innerHTML = '✔';
        btn.dataset.nome = med.nome;
        btn.dataset.hora = horaFormatada;

        // Verifica se já está checado
        if (checagens[med.nome]?.[horaFormatada]?.checado) {
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

  // Adiciona evento de clique aos botões
  tableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const nome = btn.dataset.nome;
    const hora = btn.dataset.hora;
    const dataHoje = new Date().toISOString().split('T')[0];
    const isChecked = btn.classList.contains('checked');

    if (isChecked) {
      if (confirm(`Deseja reverter a administração de ${nome} às ${hora}?`)) {
        try {
          // Remove do histórico
          const historicoRef = ref(database, `historico/${atendimento}`);
          const historicoSnapshot = await get(historicoRef);
          
          if (historicoSnapshot.exists()) {
            const historico = historicoSnapshot.val();
            for (const [key, item] of Object.entries(historico)) {
              if (item.medicamento === nome && item.horarioPrevisto === hora && item.data === dataHoje) {
                await remove(ref(database, `historico/${atendimento}/${key}`));
                break;
              }
            }
          }

          // Remove da lista de checagens
          await remove(ref(database, `checagens/${atendimento}/${dataHoje}/${nome}/${hora}`));

          // Atualiza UI
          btn.classList.replace('btn-success', 'btn-outline-success');
          btn.innerHTML = '✔';
          btn.classList.remove('checked');
        } catch (error) {
          console.error("Erro ao reverter:", error);
          alert("Erro ao reverter administração");
        }
      }
    } else {
      if (confirm(`Confirmar administração de ${nome} às ${hora}?`)) {
        const horarioReal = new Date().toLocaleTimeString("pt-BR", { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        // Atualiza checagens
        await set(ref(database, `checagens/${atendimento}/${dataHoje}/${nome}/${hora}`), {
          checado: true,
          horarioReal
        });

        // Adiciona ao histórico
        await push(ref(database, `historico/${atendimento}`), {
          medicamento: nome,
          horarioPrevisto: hora,
          horarioReal,
          data: dataHoje
        });

        // Atualiza UI
        btn.classList.replace('btn-outline-success', 'btn-success');
        btn.innerHTML = '✓';
        btn.classList.add('checked');
      }
    }
  });
}

// Formulário para adicionar medicamento
addMedForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeMed").value.trim();
  const intervalo = parseInt(document.getElementById("intervalo").value);

  if (!nome) {
    alert("Por favor, informe o nome do medicamento");
    return;
  }

  try {
    // Verifica se medicamento já existe
    const snapshot = await get(ref(database, `medicamentos/${atendimento}`));
    if (snapshot.exists()) {
      const medicamentos = snapshot.val();
      const existe = Object.values(medicamentos).some(m => m.nome.toLowerCase() === nome.toLowerCase());
      
      if (existe) {
        alert("Medicamento já cadastrado");
        return;
      }
    }

    // Adiciona novo medicamento
    await push(ref(database, `medicamentos/${atendimento}`), {
      nome,
      intervalo
    });

    addMedForm.reset();
    bootstrap.Modal.getInstance(document.getElementById("medModal")).hide();
    carregarMedicamentos();
  } catch (error) {
    console.error("Erro ao adicionar medicamento:", error);
    alert("Erro ao adicionar medicamento");
  }
});

// Modal para remover medicamento
async function mostrarModalRemocao() {
  const snapshot = await get(ref(database, `medicamentos/${atendimento}`));
  if (!snapshot.exists()) {
    alert("Nenhum medicamento cadastrado");
    return;
  }

  const modalHTML = `
    <div class="modal fade" id="removerModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Remover Medicamento</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Selecione o medicamento que deseja remover:</p>
            <div class="list-group" id="listaMedicamentos"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = modalHTML;
  document.body.appendChild(modalDiv);

  const medicamentos = snapshot.val();
  const lista = modalDiv.querySelector('#listaMedicamentos');
  
  Object.entries(medicamentos).forEach(([key, med]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'list-group-item list-group-item-action';
    btn.textContent = `${med.nome} (a cada ${med.intervalo}h)`;
    btn.onclick = async () => {
      if (confirm(`Tem certeza que deseja remover ${med.nome}?`)) {
        await remove(ref(database, `medicamentos/${atendimento}/${key}`));
        carregarMedicamentos();
        bootstrap.Modal.getInstance(modalDiv.querySelector('#removerModal')).hide();
      }
    };
    lista.appendChild(btn);
  });

  const modal = new bootstrap.Modal(modalDiv.querySelector('#removerModal'));
  modal.show();

  modalDiv.querySelector('#removerModal').addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(modalDiv);
  });
}

removerBtn.addEventListener("click", mostrarModalRemocao);

// Inicialização
gerarCabecalho();
carregarMedicamentos();