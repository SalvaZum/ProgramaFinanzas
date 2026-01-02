import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, getDocs, deleteDoc} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const logoutBtn = document.getElementById("confirmLogout");

const categoriaSelect = document.getElementById("categoria");
const nuevaCategoriaInput = document.getElementById("nueva-categoria");
const agregarCategoriaBtn = document.getElementById("agregar-categoria");

const filtroMesInput = document.getElementById("filtro-mes");
let mesSeleccionado = null;

const objetivoInput = document.getElementById("objetivo-input");
const guardarObjetivoBtn = document.getElementById("guardar-objetivo");
const barraProgreso = document.getElementById("barra-progreso");
const textoProgreso = document.getElementById("texto-progreso");
const periodoSelect = document.getElementById("periodo-objetivo");

const listaCategorias = document.getElementById("mostrar-categorias")

let objetivo = null;

/* =====================
   AUTH + PROTECCIÓN
===================== */
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "index.html"; 
    return;
  }

  usuarioActual = user;

  // Mostrar info del usuario
  document.getElementById("user-info").hidden = false;
  document.getElementById("user-name").textContent = user.displayName;
  document.getElementById("user-photo").src = user.photoURL;

  const hoy = new Date().toISOString().slice(0, 7);
  filtroMesInput.value = hoy;
  mesSeleccionado = hoy;

  await cargarMovimientos();
  cargarObjetivo();
  actualizarObjetivo()
  mostrarHistorial();
  inicializarGrafico();
  actualizarResumen();
  cargarCategorias();
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
    categoria: categoriaSelect.value,
    fecha: new Date().toISOString()
  };

  movimientos.push(movimiento);
  await guardarMovimiento(movimiento);

  mostrarHistorial();
  actualizarGrafico();
  actualizarResumen();
  actualizarObjetivo();
  form.reset();
});

/* =====================
  CATEGORIAs
===================== */
async function guardarCategoria(nombre) {
  const ref = doc(
    collection(db, "users", usuarioActual.uid, "categorias")
  );

  await setDoc(ref, {
    nombre
  });
}

agregarCategoriaBtn.addEventListener("click", async () => {
  const nombre = nuevaCategoriaInput.value.trim();
  if (!nombre || !usuarioActual) return;

  await guardarCategoria(nombre);
  nuevaCategoriaInput.value = "";
  cargarCategorias();
});

async function cargarCategorias() {
  categoriaSelect.innerHTML = `
    <option value="">Seleccionar categoría</option>
  `;

  listaCategorias.innerHTML = "";

  const snap = await getDocs(
    collection(db, "users", usuarioActual.uid, "categorias")
  );

  snap.forEach(docu => {
    const data = docu.data();
    const id = docu.id;

    // ---- SELECT ----
    const opt = document.createElement("option");
    opt.value = data.nombre;
    opt.textContent = data.nombre;
    categoriaSelect.appendChild(opt);

    // ---- LISTA VISUAL ----
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center m-3 border p-2";

    li.innerHTML = `
      ${data.nombre}
      <button class="btn btn-danger btn-sm" onclick="eliminarCategoria('${id}')">
        Eliminar
      </button>
    `;

    listaCategorias.appendChild(li);
  });
}

window.eliminarCategoria = async (id) => {
  await deleteDoc(
    doc(db, "users", usuarioActual.uid, "categorias", id)
  );

  cargarCategorias();
};

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
  movimientos = obtenerMovimientosFiltrados().filter(m => m.id !== id);

  await deleteDoc(
    doc(db, "users", usuarioActual.uid, "movimientos", id.toString())
  );

  mostrarHistorial();
  actualizarGrafico();
  actualizarResumen();
  actualizarObjetivo();
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

  obtenerMovimientosFiltrados().forEach(m => {
    const li = document.createElement("li");
    li.className = "item";

    li.innerHTML = `
      <span>
        ${formatearFecha(m.fecha)} ${m.descripcion}
        <em>${m.categoria}</em>
        <strong>$<span id="monto-${m.id}">${m.monto}</span></strong>
      </span>
      <div class="acciones">
        <button onclick="editarMonto(${m.id})" class="border-0 bg-white">✏️</button>
        <button onclick="eliminarMovimiento(${m.id})" class="border-0 bg-white">🗑️</button>
      </div>
    `;

    if (m.tipo === "ingreso") listaIngresos.appendChild(li);
    if (m.tipo === "costo") listaCostos.appendChild(li);
    if (m.tipo === "ahorro") listaAhorros.appendChild(li);
  });
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/* =====================
   ACUTALIZAR BALANCE Y OBJETIVO AHORRO
===================== */
function actualizarResumen() {
  const filtrados = obtenerMovimientosFiltrados();

  const ingresos = filtrados
    .filter(m => m.tipo === "ingreso")
    .reduce((a, m) => a + m.monto, 0);

  const costos = filtrados
    .filter(m => m.tipo === "costo")
    .reduce((a, m) => a + m.monto, 0);

  const ahorros = filtrados
    .filter(m => m.tipo === "ahorro")
    .reduce((a, m) => a + m.monto, 0);

  const balance = ingresos - costos - ahorros;

  document.getElementById("total-ingresos").textContent = `$${ingresos}`;
  document.getElementById("total-costos").textContent = `$${costos}`;
  document.getElementById("total-ahorros").textContent = `$${ahorros}`;
  document.getElementById("balance-total").textContent = `$${balance}`;

  const balanceCard = document.querySelector(".balance");
  balanceCard.classList.remove("positivo", "negativo");
  balanceCard.classList.add(balance >= 0 ? "positivo" : "negativo");
}

function actualizarObjetivo() {
  if (!objetivo) {
    barraProgreso.style.width = "0%";
    textoProgreso.textContent = "Definí un objetivo de ahorro";
    return;
  }

  const ahorrado = calcularAhorroObjetivo();
  const porcentaje = Math.min(
    Math.round((ahorrado / objetivo.monto) * 100),
    100
  );

  barraProgreso.style.width = `${porcentaje}%`;

  const diasRestantes = Math.ceil(
    (objetivo.fin - new Date()) / (1000 * 60 * 60 * 24)
  );

  textoProgreso.textContent =
    `$${ahorrado} / $${objetivo.monto} (${porcentaje}%) — ${diasRestantes} días restantes`;
}


function calcularFechasObjetivo(periodo) {
  const inicio = new Date();
  const fin = new Date(inicio);

  if (periodo === "mensual") fin.setMonth(fin.getMonth() + 1);
  if (periodo === "trimestral") fin.setMonth(fin.getMonth() + 3);
  if (periodo === "anual") fin.setFullYear(fin.getFullYear() + 1);

  return { inicio, fin };
}

async function cargarObjetivo() {
  const ref = doc(db, "users", usuarioActual.uid, "objetivo", "actual");
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();
  const ahora = new Date();
  const fin = new Date(data.fin);

  // 🔁 SI VENCIO → RESET
  if (ahora > fin) {
    await deleteDoc(ref);
    objetivo = null;
    actualizarObjetivo();
    return;
  }

  objetivo = {
    monto: data.monto,
    periodo: data.periodo,
    inicio: new Date(data.inicio),
    fin: fin
  };

  objetivoInput.value = objetivo.monto;
  periodoSelect.value = objetivo.periodo;

  actualizarObjetivo();
}

async function guardarObjetivo() {
  const monto = Number(objetivoInput.value);
  const periodo = periodoSelect.value;

  if (isNaN(monto) || monto <= 0) return;

  let inicio, fin;

  if (objetivo) {
    // 🔹 YA EXISTE → NO reiniciar progreso
    inicio = objetivo.inicio;
    fin = objetivo.fin;
  } else {
    // 🔹 NUEVO objetivo
    const fechas = calcularFechasObjetivo(periodo);
    inicio = fechas.inicio;
    fin = fechas.fin;
  }

  objetivo = { monto, periodo, inicio, fin };

  await setDoc(
    doc(db, "users", usuarioActual.uid, "objetivo", "actual"),
    {
      monto,
      periodo,
      inicio: inicio.toISOString(),
      fin: fin.toISOString()
    }
  );

  actualizarObjetivo();
}

guardarObjetivoBtn.addEventListener("click", guardarObjetivo);

function calcularAhorroObjetivo() {
  if (!objetivo) return 0;

  return obtenerMovimientosFiltrados()
    .filter(m =>
      m.tipo === "ahorro" &&
      new Date(m.fecha) >= objetivo.inicio &&
      new Date(m.fecha) <= objetivo.fin
    )
    .reduce((a, m) => a + m.monto, 0);
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
  actualizarObjetivo();
  actualizarResumen();
};

/* =====================
   GRÁFICO
===================== */
function calcularTotales() {
  const sum = tipo =>
    obtenerMovimientosFiltrados()
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

/* =====================
  FILTRO
===================== */
function obtenerMovimientosFiltrados() {
  if (!mesSeleccionado) return movimientos;

  return movimientos.filter(m => {
    if (!m.fecha) return false;

    const fecha = new Date(m.fecha);
    const mesMovimiento = fecha.toISOString().slice(0, 7); // YYYY-MM

    return mesMovimiento === mesSeleccionado;
  });
}

filtroMesInput.addEventListener("change", e => {
  mesSeleccionado = e.target.value;

  mostrarHistorial();
  actualizarResumen();
  actualizarGrafico();
  actualizarObjetivo();
});

/* =====================
  BOOTSTRAP
===================== */
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');

tooltipTriggerList.forEach(el => {
  new bootstrap.Tooltip(el);
});
