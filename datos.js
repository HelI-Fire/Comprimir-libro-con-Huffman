// MÓDULO DE GESTIÓN DE DATOS - LOGAN

let arregloActual = [];   // Arreglo activo para visualización y ordenamiento
let arregloOriginal = []; // Respaldo estático para la función de reinicio

/**
 * Genera un nuevo arreglo de números aleatorios.
 * @param {number} tamano - Cantidad de elementos (por defecto 20).
 * @param {number} min - Valor mínimo (por defecto 10).
 * @param {number} max - Valor máximo (por defecto 100).
 * @returns {Array} El nuevo arreglo generado.
 */
function generarArregloAleatorio(tamano = 20, min = 10, max = 100) {
    arregloActual = [];
    
    for (let i = 0; i < tamano; i++) {
        const valorAleatorio = Math.floor(Math.random() * (max - min + 1)) + min;
        arregloActual.push(valorAleatorio);
    }
    
    // Guardamos una copia independiente en 'arregloOriginal'
    arregloOriginal = [...arregloActual];
    
    console.log("Nuevo arreglo generado:", arregloActual);
    return arregloActual;
}

/**
 * Restablece 'arregloActual' a los datos originales.
 * @returns {Array} El arreglo restaurado.
 */
function reiniciarArreglo() {
    if (arregloOriginal.length === 0) {
        console.warn("No hay un arreglo generado previamente.");
        return [];
    }
    
    arregloActual = [...arregloOriginal];
    
    console.log("Arreglo reiniciado al estado inicial:", arregloActual);
    return arregloActual;
}

/**
 * Obtiene el estado actual del arreglo.
 * @returns {Array}
 */
function obtenerArregloActual() {
    return arregloActual;
}

// --- DATOS DE LA COMPARACIÓN ---
// Los dos métodos comparados usan exactamente este mismo arreglo.
let arregloComparacion = [];

/**
 * Genera el arreglo que compartirán los dos métodos de la comparación.
 * @returns {Array} El nuevo arreglo generado.
 */
function generarArregloComparacion(tamano = 15, min = 15, max = 114) {
    arregloComparacion = [];

    for (let i = 0; i < tamano; i++) {
        arregloComparacion.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    return arregloComparacion;
}

/**
 * Obtiene el arreglo actual de la comparación.
 * @returns {Array}
 */
function obtenerArregloComparacion() {
    return arregloComparacion;
}
//---fin----