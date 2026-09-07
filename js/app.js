/* =========================================================
   Cuenta Clara — app.js
   Maneja: caracterización inicial (wizard), dashboard,
   cálculos financieros y persistencia en localStorage.
   ========================================================= */

const STORAGE_KEY = "cuentaClaraData";

/* ---------------------------------------------------------
   Estado en memoria (se sincroniza siempre con localStorage)
   --------------------------------------------------------- */
let appData = {
  ingresos: {
    principal: 0,
    adicional: 0
  },
  gastosFijos: [], // { id, nombre, monto, compartido, metodo, valor, montoReal }
  gastosVariables: [] // { id, concepto, monto, categoria, fecha }
};

let gastoFijoContador = 0;

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */
function formatoMoneda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });
}

function generarId() {
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

function guardarEnLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function cargarDeLocalStorage() {
  const guardado = localStorage.getItem(STORAGE_KEY);
  if (!guardado) return null;
  try {
    return JSON.parse(guardado);
  } catch (e) {
    console.error("Error leyendo datos guardados:", e);
    return null;
  }
}

/* ---------------------------------------------------------
   Cálculos financieros
   --------------------------------------------------------- */
function calcularMontoRealGasto(gasto) {
  if (!gasto.compartido) return Number(gasto.monto) || 0;

  const monto = Number(gasto.monto) || 0;
  const valor = Number(gasto.valor) || 0;

  if (gasto.metodo === "personas") {
    // valor = número de personas con quienes se divide (incluyéndome)
    return valor > 0 ? monto / valor : monto;
  }
  // método por porcentaje directo de aporte personal
  return monto * (valor / 100);
}

function totalIngresos() {
  return (Number(appData.ingresos.principal) || 0) + (Number(appData.ingresos.adicional) || 0);
}

function totalGastosFijosReal() {
  return appData.gastosFijos.reduce((acc, g) => acc + calcularMontoRealGasto(g), 0);
}

function totalGastosVariables() {
  return appData.gastosVariables.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
}

function balanceDisponible() {
  return totalIngresos() - totalGastosFijosReal();
}

/* =========================================================
   WIZARD — Caracterización inicial
   ========================================================= */
const wizardForm = document.getElementById("wizardForm");
const stepsIndicator = document.getElementById("stepsIndicator");
const gastosFijosList = document.getElementById("gastosFijosList");
const sinGastosFijos = document.getElementById("sinGastosFijos");
const gastoFijoTemplate = document.getElementById("gastoFijoTemplate");
const btnAddGasto = document.getElementById("btnAddGasto");
const wizardSummary = document.getElementById("wizardSummary");

let pasoActual = 1;

function irAPaso(numero) {
  document.querySelectorAll(".wizard-step").forEach(el => {
    el.classList.toggle("is-active", Number(el.dataset.step) === numero);
  });
  document.querySelectorAll(".steps__item").forEach(el => {
    const step = Number(el.dataset.step);
    el.classList.toggle("is-active", step === numero);
    el.classList.toggle("is-done", step < numero);
  });
  pasoActual = numero;

  if (numero === 3) renderResumenWizard();
}

wizardForm.addEventListener("click", (e) => {
  const next = e.target.closest("[data-next]");
  const prev = e.target.closest("[data-prev]");

  if (next) {
    if (pasoActual === 1 && !validarPaso1()) return;
    irAPaso(Number(next.dataset.next));
  }
  if (prev) {
    irAPaso(Number(prev.dataset.prev));
  }
});

function validarPaso1() {
  const input = document.getElementById("ingresoPrincipal");
  const valido = input.value !== "" && Number(input.value) > 0;
  input.classList.toggle("is-invalid", !valido);
  return valido;
}

/* ----- Gastos fijos dinámicos ----- */
function crearFilaGastoFijo() {
  const fragment = gastoFijoTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".gasto-fijo-item");
  const id = generarId();
  item.dataset.gastoId = id;

  gastosFijosList.appendChild(fragment);
  actualizarVisibilidadSinGastos();
  return id;
}

btnAddGasto.addEventListener("click", () => crearFilaGastoFijo());

gastosFijosList.addEventListener("click", (e) => {
  const btnRemove = e.target.closest(".btn-remove-gasto");
  if (btnRemove) {
    btnRemove.closest(".gasto-fijo-item").remove();
    actualizarVisibilidadSinGastos();
  }
});

gastosFijosList.addEventListener("change", (e) => {
  const item = e.target.closest(".gasto-fijo-item");
  if (!item) return;

  if (e.target.classList.contains("gf-compartido")) {
    const detalle = item.querySelector(".gf-compartido-detalle");
    const valorCol = item.querySelector(".gf-compartido-valor");
    const checked = e.target.checked;
    detalle.classList.toggle("d-none", !checked);
    valorCol.classList.toggle("d-none", !checked);
  }

  if (e.target.classList.contains("gf-metodo")) {
    const label = item.querySelector(".gf-valor-label");
    label.textContent = e.target.value === "personas" ? "N.°" : "%";
  }

  actualizarPreviewGasto(item);
});

gastosFijosList.addEventListener("input", (e) => {
  const item = e.target.closest(".gasto-fijo-item");
  if (item) actualizarPreviewGasto(item);
});

function actualizarPreviewGasto(item) {
  const monto = Number(item.querySelector(".gf-monto").value) || 0;
  const compartido = item.querySelector(".gf-compartido").checked;
  const preview = item.querySelector(".gf-real-preview");

  if (!compartido) {
    preview.textContent = monto > 0 ? `Pagas: ${formatoMoneda(monto)}` : "";
    return;
  }

  const metodo = item.querySelector(".gf-metodo").value;
  const valor = Number(item.querySelector(".gf-valor").value) || 0;
  const real = calcularMontoRealGasto({ compartido: true, metodo, valor, monto });
  preview.textContent = `Tu parte real: ${formatoMoneda(real)}`;
}

function actualizarVisibilidadSinGastos() {
  const hay = gastosFijosList.children.length > 0;
  sinGastosFijos.classList.toggle("d-none", hay);
}

function leerGastosFijosDelFormulario() {
  const items = gastosFijosList.querySelectorAll(".gasto-fijo-item");
  const lista = [];

  items.forEach(item => {
    const nombre = item.querySelector(".gf-nombre").value.trim();
    const monto = Number(item.querySelector(".gf-monto").value) || 0;
    const compartido = item.querySelector(".gf-compartido").checked;
    const metodo = item.querySelector(".gf-metodo").value;
    const valor = Number(item.querySelector(".gf-valor").value) || 0;

    if (!nombre || monto <= 0) return; // ignora filas incompletas

    const gasto = {
      id: item.dataset.gastoId || generarId(),
      nombre,
      monto,
      compartido,
      metodo: compartido ? metodo : null,
      valor: compartido ? valor : null
    };
    gasto.montoReal = calcularMontoRealGasto(gasto);
    lista.push(gasto);
  });

  return lista;
}

/* ----- Resumen paso 3 ----- */
function renderResumenWizard() {
  const principal = Number(document.getElementById("ingresoPrincipal").value) || 0;
  const adicional = Number(document.getElementById("ingresoAdicional").value) || 0;
  const gastosFijos = leerGastosFijosDelFormulario();

  const totalIng = principal + adicional;
  const totalGF = gastosFijos.reduce((acc, g) => acc + g.montoReal, 0);
  const disponible = totalIng - totalGF;

  wizardSummary.innerHTML = `
    <div class="summary-grid__item">
      <span>Ingresos totales</span>
      <strong>${formatoMoneda(totalIng)}</strong>
    </div>
    <div class="summary-grid__item">
      <span>Gastos fijos (${gastosFijos.length})</span>
      <strong>${formatoMoneda(totalGF)}</strong>
    </div>
    <div class="summary-grid__item">
      <span>Saldo disponible base</span>
      <strong>${formatoMoneda(disponible)}</strong>
    </div>
  `;
}

/* ----- Envío del formulario (Guardar configuración) ----- */
wizardForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!validarPaso1()) {
    irAPaso(1);
    return;
  }

  const principal = Number(document.getElementById("ingresoPrincipal").value) || 0;
  const adicional = Number(document.getElementById("ingresoAdicional").value) || 0;
  const gastosFijos = leerGastosFijosDelFormulario();

  appData = {
    ingresos: { principal, adicional },
    gastosFijos,
    gastosVariables: []
  };

  guardarEnLocalStorage();
  mostrarDashboard();
});

/* =========================================================
   DASHBOARD
   ========================================================= */
const wizardView = document.getElementById("wizardView");
const dashboardView = document.getElementById("dashboardView");
const btnReset = document.getElementById("btnReset");

const cardIngresos = document.getElementById("cardIngresos");
const cardGastosFijos = document.getElementById("cardGastosFijos");
const cardBalance = document.getElementById("cardBalance");
const cardGastosVariables = document.getElementById("cardGastosVariables");

const gastoDiarioForm = document.getElementById("gastoDiarioForm");
const gastosDiariosBody = document.getElementById("gastosDiariosBody");
const sinGastosDiarios = document.getElementById("sinGastosDiarios");

function mostrarDashboard() {
  wizardView.classList.add("d-none");
  dashboardView.classList.remove("d-none");
  btnReset.classList.remove("d-none");
  renderDashboard();
}

function mostrarWizard() {
  dashboardView.classList.add("d-none");
  wizardView.classList.remove("d-none");
  btnReset.classList.add("d-none");
  irAPaso(1);
}

function renderDashboard() {
  cardIngresos.textContent = formatoMoneda(totalIngresos());
  cardGastosFijos.textContent = formatoMoneda(totalGastosFijosReal());
  cardBalance.textContent = formatoMoneda(balanceDisponible() - totalGastosVariables());
  cardGastosVariables.textContent = formatoMoneda(totalGastosVariables());

  renderTablaGastosDiarios();
}

function renderTablaGastosDiarios() {
  gastosDiariosBody.innerHTML = "";

  const gastos = [...appData.gastosVariables].sort((a, b) => b.fecha.localeCompare(a.fecha));

  gastos.forEach(g => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${escaparHtml(g.concepto)}</td>
      <td><span class="badge-categoria badge-categoria--${g.categoria}">${g.categoria}</span></td>
      <td>${formatearFecha(g.fecha)}</td>
      <td class="text-end">${formatoMoneda(g.monto)}</td>
      <td class="text-end">
        <button type="button" class="btn-delete-row" data-id="${g.id}" title="Eliminar">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    `;
    gastosDiariosBody.appendChild(fila);
  });

  sinGastosDiarios.classList.toggle("d-none", gastos.length > 0);
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function formatearFecha(iso) {
  const fecha = new Date(iso);
  return fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

/* ----- Registrar gasto diario ----- */
gastoDiarioForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const concepto = document.getElementById("gdConcepto").value.trim();
  const monto = Number(document.getElementById("gdMonto").value);
  const categoria = document.getElementById("gdCategoria").value;

  if (!concepto || !monto || monto <= 0) return;

  appData.gastosVariables.push({
    id: generarId(),
    concepto,
    monto,
    categoria,
    fecha: new Date().toISOString()
  });

  guardarEnLocalStorage();
  renderDashboard();
  gastoDiarioForm.reset();
  document.getElementById("gdConcepto").focus();
});

/* ----- Eliminar gasto diario ----- */
gastosDiariosBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-delete-row");
  if (!btn) return;

  const id = btn.dataset.id;
  appData.gastosVariables = appData.gastosVariables.filter(g => g.id !== id);
  guardarEnLocalStorage();
  renderDashboard();
});

/* ----- Reset / Reconfigurar ----- */
btnReset.addEventListener("click", () => {
  const confirmar = confirm("¿Seguro que quieres borrar toda tu información y empezar de nuevo?");
  if (!confirmar) return;

  localStorage.removeItem(STORAGE_KEY);
  appData = { ingresos: { principal: 0, adicional: 0 }, gastosFijos: [], gastosVariables: [] };

  wizardForm.reset();
  gastosFijosList.innerHTML = "";
  actualizarVisibilidadSinGastos();

  mostrarWizard();
});

/* =========================================================
   INICIO — Carga automática al abrir la app
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const guardado = cargarDeLocalStorage();

  if (guardado && guardado.ingresos && guardado.gastosFijos) {
    appData = guardado;
    mostrarDashboard();
  } else {
    mostrarWizard();
  }
});
