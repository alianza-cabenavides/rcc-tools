# rcc-tools

CLI para automatizar la generación del documento **RCC (Registro de Control de Cambios)** y la gestión de tags Git al finalizar un requerimiento o fix de software.

## ¿Qué hace?

Al ejecutar `rcc generate` desde cualquier repositorio de trabajo, el CLI:

1. Detecta el código y tipo de cambio a partir del nombre de la rama (`RQ####` o `GP####`)
2. Calcula los archivos modificados y el rango de commits respecto a la rama base
3. Solicita el título del requerimiento y el nombre del desarrollador
4. Crea los tags Git de inicio y fin con formato estandarizado
5. Genera el documento Excel RCC desde la plantilla corporativa con todos los datos completados
6. Publica los tags en el repositorio remoto

---

## Requisitos

- Node.js 18 o superior
- Git instalado y configurado (`git config user.name`)
- Acceso de escritura al repositorio remoto (para publicar tags)

---

## Instalación

```bash
git clone https://github.com/CarlosBean/rcc-tools.git
cd rcc-tools
npm install
npm link
```

`npm link` registra el comando `rcc` de forma global, disponible desde cualquier directorio.

### Plantilla Excel

Coloca la plantilla corporativa en:

```
rcc-tools/templates/template-front.xlsx
```

---

## Configuración

Edita `config.json` en la raíz del proyecto según tu entorno:

```json
{
  "baseBranch": "main",
  "templatePath": "./templates/template-front.xlsx",
  "outputPath": "./output"
}
```

| Campo          | Descripción                                              | Default                              |
|----------------|----------------------------------------------------------|--------------------------------------|
| `baseBranch`   | Rama base contra la que se calcula el diff y los commits | `main`                               |
| `templatePath` | Ruta a la plantilla Excel corporativa                    | `./templates/template-front.xlsx`    |
| `outputPath`   | Directorio donde se guardan los RCC generados            | `./output`                           |

---

## Convención de ramas

El CLI infiere el tipo de cambio a partir del prefijo de la rama activa:

| Prefijo | Tipo   | Ejemplo              |
|---------|--------|----------------------|
| `RQ`    | `dev`  | `RQ1234-nueva-feature` |
| `GP`    | `hot`  | `GP5678-fix-critico`   |

> La detección es case-insensitive (`rq0042` se interpreta igual que `RQ0042`).

---

## Uso

Desde cualquier repositorio Git con una rama `RQ####` o `GP####` activa:

```bash
rcc generate
```

### Ejemplo de sesión

```
Rama detectada → código: RQ1042, tipo: dev
Archivos modificados: 5

Título del requerimiento: Implementación de módulo de pagos
Desarrollador [Carlos Benavides]:

Creando tags...
Generando documento RCC...
Publicando tags en remoto...

✔ Proceso completado:
  Documento : /path/to/rcc-tools/output/FM-RG-CONTROL DE CAMBIOS RQ1042 V1 Front.xlsx
  Tag inicial: devRQ1042_20260313_1_initial → a1b2c3d
  Tag final  : devRQ1042_20260313_1_final   → e4f5g6h
  Archivos   : 5
```

### Documento generado

El archivo Excel se guarda en `output/` con el nombre:

```
FM-RG-CONTROL DE CAMBIOS <CÓDIGO> V1 Front.xlsx
```

Los datos se escriben en:

- **Hoja 1** — Título (B9), código (B17), desarrollador (B19), fecha (B16)
- **Hoja 3** — Tag inicial (F8), tag final (F9), tabla de archivos desde la fila 16

### Formato de los tags

```
<tipo><código>_<YYYYMMDD>_<N>_initial
<tipo><código>_<YYYYMMDD>_<N>_final
```

Si ya existen tags para el mismo código y fecha, `<N>` se incrementa automáticamente.

---

## Estructura del proyecto

```
rcc-tools/
├── src/
│   ├── index.js      — Punto de entrada y orquestador (commander)
│   ├── git.js        — Operaciones Git (diff, commits, tags)
│   └── excel.js      — Generación del documento RCC desde plantilla
├── tests/
│   ├── git.test.js   — Tests de integración del módulo git
│   └── excel.test.js — Tests de integración del módulo excel
├── templates/        — Plantilla corporativa (no incluida en el repo)
├── output/           — RCCs generados (gitignored)
└── config.json       — Configuración del CLI
```

---

## Tests

```bash
npm test
```

Los tests usan el runner nativo de Node.js (`node:test`) sin dependencias externas. Los tests de `git.js` crean repositorios Git temporales para validar el comportamiento real de cada función.

---

## Desinstalación

```bash
cd rcc-tools
npm unlink
```
