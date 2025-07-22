// nota-script.js
import { database } from './firebase-config.js';
import { ref, push, get, set, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const atendimento = urlParams.get("atendimento");
const notasContainer = document.getElementById("notasContainer");
const addNotaForm = document.getElementById("addNotaForm");
const removerNotaBtn = document.getElementById("removerNotaBtn");
const removerNotaForm = document.getElementById("removerNotaForm");
const notaSelecionada = document.getElementById("notaSelecionada");

// Limitar a digitação nos campos de título e texto
const tituloInput = document.getElementById("tituloNota");
const textoInput = document.getElementById("textoNota");

tituloInput.setAttribute("maxlength", "100");
textoInput.setAttribute("maxlength", "4000");

function formatarDataCompleta(timestamp) {
  const data = new Date(timestamp);
  return data.toLocaleDateString("pt-BR") + ' ' + data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
}

async function carregarNotas() {
  notasContainer.innerHTML = "";
  notaSelecionada.innerHTML = "";

  const snap = await get(ref(database, `notas/${atendimento}`));
  if (!snap.exists()) {
    notasContainer.innerHTML = '<p class="text-muted">Nenhuma nota cadastrada</p>';
    return;
  }

  const notas = Object.entries(snap.val()).sort((a, b) => b[1].timestamp - a[1].timestamp);

  for (const [key, nota] of notas) {
    const div = document.createElement("div");
    div.className = "note-entry";

    const textPreview = document.createElement("div");
    textPreview.className = "note-text preview";
    textPreview.id = `preview-${key}`;
    textPreview.textContent = nota.texto.substring(0, 100) + (nota.texto.length > 100 ? '...' : '');
    textPreview.style.whiteSpace = "pre-wrap";
    textPreview.style.wordBreak = "break-word";
    textPreview.style.display = "block";

    const toggleText = () => {
      const isExpanded = textPreview.classList.contains("expanded");
      if (isExpanded) {
        textPreview.textContent = nota.texto.substring(0, 100) + (nota.texto.length > 100 ? '...' : '');
        textPreview.classList.remove("expanded");
      } else {
        textPreview.textContent = nota.texto;
        textPreview.classList.add("expanded");
      }
    };

    div.innerHTML = `
      <div class="note-date">${formatarDataCompleta(nota.timestamp)}</div>
      <div class="note-title">${nota.titulo}</div>
    `;
    div.appendChild(textPreview);
    div.addEventListener("click", toggleText);
    notasContainer.appendChild(div);

    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${nota.titulo} (${formatarDataCompleta(nota.timestamp)})`;
    notaSelecionada.appendChild(option);
  }
}

addNotaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = tituloInput.value.trim().substring(0, 100);
  const texto = textoInput.value.trim().substring(0, 4000);
  const timestamp = Date.now();

  await push(ref(database, `notas/${atendimento}`), { titulo, texto, timestamp });

  bootstrap.Modal.getInstance(document.getElementById("notaModal")).hide();
  addNotaForm.reset();
  carregarNotas();
});

removerNotaBtn.addEventListener("click", () => {
  const modal = new bootstrap.Modal(document.getElementById("removerNotaModal"));
  modal.show();
});

removerNotaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = notaSelecionada.value;
  if (!key) return;
  await remove(ref(database, `notas/${atendimento}/${key}`));
  bootstrap.Modal.getInstance(document.getElementById("removerNotaModal")).hide();
  carregarNotas();
});

carregarNotas();
