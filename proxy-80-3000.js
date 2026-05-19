/**
 * Proxy: escucha en LISTEN_PORT y reenvía a 127.0.0.1:3000
 * Por defecto LISTEN_PORT=8080 (no requiere admin). Para que el 80 llegue aquí,
 * ejecutá una vez como admin: configurar-redir-80-a-proxy.bat
 */
const http = require('http');
const LISTEN_PORT = parseInt(process.env.PROXY_PORT || '8080', 10);
const TARGET = 'http://127.0.0.1:3000';

const server = http.createServer((req, res) => {
  const url = TARGET + (req.url || '/');
  const opts = {
    method: req.method,
    headers: req.headers,
  };
  const proxy = http.request(url, opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on('error', (err) => {
    console.error('Error al conectar con la app en 3000:', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('App no responde en el puerto 3000. ¿Está corriendo iniciar.bat?');
  });
  req.pipe(proxy);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log('Proxy activo: puerto', LISTEN_PORT, '-> http://localhost:3000');
  if (LISTEN_PORT !== 80) {
    console.log('Para que el puerto 80 llegue aqui, ejecuta UNA VEZ como admin: configurar-redir-80-a-proxy.bat');
  }
  console.log('Asegurate de tener la app corriendo (iniciar.bat). Ctrl+C para salir.');
});

server.on('error', (err) => {
  if (err.code === 'EACCES') {
    console.error('Puerto', LISTEN_PORT, 'requiere permisos de administrador o esta en uso.');
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
});
