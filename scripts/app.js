import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =====================
   VARIABLES
===================== */
let movimientos = [];
let grafico = null;
let usuarioActual = null;

/* =====================
   DOM
===================== */
const form = document.getElementById("form");
const tipo = document.getElementById("tipo");
const descripcion = document.getElementById("descripcion");
const monto = document.getElementById("monto");

const listaIngresos = document.getElementById("lista-ingresos");
const listaCostos = document.getElementById("lista-costos");
const listaAhorros = document.getElementById("lista-ahorros");

const logoutBtn = document.getElementById("logoutBtn");

/* =====================
   AUTH + PROTECCIÓN
===================== */
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "index.html"; // 🔒 protección
    return;
  }

  usuarioActual = user;

  // Mostrar info del usuario
  document.getElementById("user-info").hidden = false;
  document.getElementById("user-name").textContent = user.displayName;
  document.getElementById("user-photo").src = user.photoURL;

  await cargarMovimientos();
  mostrarHistorial();
  inicializarGrafico();
});

logoutBtn.onclick = () => {signOut(auth)};

/* =====================
   FORM
===================== */
form.addEventListener("submit", async e => {
  e.preventDefault();

  const movimiento = {
    id: Date.now(),
    tipo: tipo.value,
    descripcion: descripcion.value,
    monto: Number(monto.value),
    fecha: new Date().toLocaleDateString()
  };

  movimientos.push(movimiento);
  await guardarMovimiento(movimiento);

  mostrarHistorial();
  actualizarGrafico();
  form.reset();
});

/* =====================
   FIRESTORE
===================== */
async function guardarMovimiento(movimiento) {
  await setDoc(
    doc(db, "users", usuarioActual.uid, "movimientos", movimiento.id.toString()),
    movimiento
  );
}

window.eliminarMovimiento = async id => {
  movimientos = movimientos.filter(m => m.id !== id);

  await deleteDoc(
    doc(db, "users", usuarioActual.uid, "movimientos", id.toString())
  );

  mostrarHistorial();
  actualizarGrafico();
};

async function cargarMovimientos() {
  movimientos = [];
  const snap = await getDocs(
    collection(db, "users", usuarioActual.uid, "movimientos")
  );
  snap.forEach(d => movimientos.push(d.data()));
}

/* =====================
   HISTORIAL
===================== */
function mostrarHistorial() {
  listaIngresos.innerHTML = "";
  listaCostos.innerHTML = "";
  listaAhorros.innerHTML = "";

  movimientos.forEach(m => {
    const li = document.createElement("li");
    li.className = "item";

    li.innerHTML = `
      <span>
        ${m.fecha} | ${m.descripcion} |
        <strong>$<span id="monto-${m.id}">${m.monto}</span></strong>
      </span>
      <div class="acciones">
        <button onclick="editarMonto(${m.id})">✏️</button>
        <button onclick="eliminarMovimiento(${m.id})">🗑️</button>
      </div>
    `;

    if (m.tipo === "ingreso") listaIngresos.appendChild(li);
    if (m.tipo === "costo") listaCostos.appendChild(li);
    if (m.tipo === "ahorro") listaAhorros.appendChild(li);
  });
}

/* =====================
   EDITAR MONTO
===================== */
window.editarMonto = id => {
  const m = movimientos.find(m => m.id === id);
  const span = document.getElementById(`monto-${id}`);

  span.innerHTML = `
    <input
      type="number"
      value="${m.monto}"
      id="input-${id}"
      onkeydown="if(event.key==='Enter') guardarMonto(${id})"
      style="width:80px"
    />
  `;
};

window.guardarMonto = async id => {
  const input = document.getElementById(`input-${id}`);
  const nuevoMonto = Number(input.value);
  if (isNaN(nuevoMonto) || nuevoMonto <= 0) return;

  const index = movimientos.findIndex(m => m.id === id);
  movimientos[index].monto = nuevoMonto;

  await guardarMovimiento(movimientos[index]);
  mostrarHistorial();
  actualizarGrafico();
};

/* =====================
   GRÁFICO
===================== */
function calcularTotales() {
  const sum = tipo =>
    movimientos
      .filter(m => m.tipo === tipo)
      .reduce((a, m) => a + m.monto, 0);

  return [sum("ingreso"), sum("costo"), sum("ahorro")];
}

function inicializarGrafico() {
  const ctx = document.getElementById("grafico");

  grafico = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Ingresos", "Costos", "Ahorros"],
      datasets: [{
        data: calcularTotales(),
        backgroundColor: ["#22c55e", "#ef4444", "#3b82f6"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function actualizarGrafico() {
  if (!grafico) return;
  grafico.data.datasets[0].data = calcularTotales();
  grafico.update();
}
