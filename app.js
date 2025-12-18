let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let idEditando = null;


form.addEventListener("submit", e => {
  e.preventDefault();

  if (idEditando) {
    const index = movimientos.findIndex(m => m.id === idEditando);

    movimientos[index] = {
      ...movimientos[index],
      tipo: tipo.value,
      descripcion: descripcion.value,
      monto: Number(monto.value)
    };

    idEditando = null;
  } else {
    movimientos.push({
      id: Date.now(),
      tipo: tipo.value,
      descripcion: descripcion.value,
      monto: Number(monto.value),
      fecha: new Date().toLocaleDateString()
    });
  }

  localStorage.setItem("movimientos", JSON.stringify(movimientos));

  mostrarHistorial();
  actualizarGrafico();
  form.reset();
});


function mostrarHistorial() {
  lista.innerHTML = "";

  movimientos.forEach(m => {
    const li = document.createElement("li");
    li.classList.add("item");

    li.innerHTML = `
      <span>
        ${m.fecha} | ${m.descripcion} |
        <strong>
          $<span id="monto-${m.id}">${m.monto}</span>
        </strong>
      </span>

      <div class="acciones">
        <button onclick="editarMonto(${m.id})">✏️</button>
        <button onclick="eliminarMovimiento(${m.id})">🗑️</button>
      </div>
    `;

    lista.appendChild(li);
  });
}


function eliminarMovimiento(id) {
  movimientos = movimientos.filter(m => m.id !== id);
  localStorage.setItem("movimientos", JSON.stringify(movimientos));

  mostrarHistorial();
  actualizarGrafico();
}

function editarMonto(id) {
  const m = movimientos.find(m => m.id === id);
  const spanMonto = document.getElementById(`monto-${id}`);

  spanMonto.innerHTML = `
    <input 
      type="number" 
      id="input-${id}" 
      value="${m.monto}"
      style="width: 80px"
    />
    <button onclick="guardarMonto(${id})">✔️</button>
  `;
}

function guardarMonto(id) {
  const input = document.getElementById(`input-${id}`);
  const nuevoMonto = Number(input.value);

  if (nuevoMonto <= 0 || isNaN(nuevoMonto)) return;

  const index = movimientos.findIndex(m => m.id === id);
  movimientos[index].monto = nuevoMonto;

  localStorage.setItem("movimientos", JSON.stringify(movimientos));

  mostrarHistorial();
  actualizarGrafico();
}

function editarMonto(id) {
  const m = movimientos.find(m => m.id === id);
  const spanMonto = document.getElementById(`monto-${id}`);

  spanMonto.innerHTML = `
    <input 
      type="number" 
      id="input-${id}" 
      value="${m.monto}"
      onkeydown="if(event.key === 'Enter') guardarMonto(${id})"
      style="width: 80px"
    />
  `;
}

function actualizarGrafico() {
  const ingresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const costos = movimientos
    .filter(m => m.tipo === "costo")
    .reduce((acc, m) => acc + m.monto, 0);

  new Chart(document.getElementById("grafico"), {
    type: "pie",
    data: {
      labels: ["Ingresos", "Costos"],
      datasets: [{
        data: [ingresos, costos]
      }]
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarHistorial();
  actualizarGrafico();
});

