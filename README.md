# Configuración de pruebas unitarias con Vitest

Este repositorio fue configurado para ejecutar pruebas unitarias utilizando [Vitest](https://vitest.dev/).

## Instalación de dependencias

Antes de ejecutar el proyecto o las pruebas unitarias, instala las dependencias con el siguiente comando:

```bash
npm install
```

## Estructura de pruebas

Las pruebas unitarias deben colocarse dentro de la carpeta:

```bash
/tests
```

El formato recomendado para los archivos de prueba es:

```bash
archivo.test.js
```

Ejemplo:

```bash
/tests/su_carpeta/suma.test.js
```

## Ejecutar pruebas

Para ejecutar todas las pruebas unitarias configuradas con Vitest, utiliza el siguiente comando:

```bash
npm test
```

O si necesitan ejecutar las pruebas de un solo archivo entonces:

```bash
npx vitest run ./src/tests/su_carpeta/archivo.test.js
```

## Tecnologías utilizadas

- Vitest
- Node.js
- npm
