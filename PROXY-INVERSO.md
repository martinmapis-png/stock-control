# Proxy inverso (puerto 80 → 3000)

Para que **fe-netstock.uno** y **http://192.168.1.13** abran la app sin poner `:3000` en la URL.

## Requisito en el router

Redirigir **puerto 80** hacia el servidor donde corre la app:

- **Puerto externo:** 80  
- **IP destino:** 192.168.1.13  
- **Puerto destino:** 80  

(El proxy en 192.168.1.13 escucha en 80 y reenvía a 3000.)

---

## Opción A: Caddy (Windows o Linux)

### 1. Instalar Caddy

- **Windows:** [Descargar](https://caddyserver.com/download) (caddy_*_windows_amd64.zip), descomprimir y poner `caddy.exe` en el PATH o en la carpeta del proyecto.  
  O con Chocolatey: `choco install caddy`
- **Linux:**  
  `sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl`  
  `curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg`  
  `curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list`  
  `sudo apt update && sudo apt install caddy`

### 2. Usar el Caddyfile del proyecto

En la carpeta del proyecto ya está `Caddyfile`. Ahí se define:

- Que Caddy escuche en el puerto 80 para `fe-netstock.uno`, `192.168.1.13` y `localhost`.
- Que reenvíe todo a `http://127.0.0.1:3000` (tu app).

### 3. Ejecutar

**Windows (como administrador):**

1. En una ventana: ejecutá **iniciar.bat** (app en 3000).
2. En otra: clic derecho en **iniciar-proxy-caddy.bat** → “Ejecutar como administrador”.

**Linux:**

```bash
# App en 3000 (en una terminal o con systemd/pm2)
npm run dev

# Caddy en 80 (necesita sudo por el puerto 80)
sudo caddy run --config /ruta/al/proyecto/Caddyfile
# o como servicio: sudo systemctl start caddy
```

Con eso, **http://fe-netstock.uno** y **http://192.168.1.13** deberían mostrar la app.

---

## Opción B: nginx (típico en Linux)

1. Instalar nginx: `sudo apt install nginx`
2. Copiar o adaptar `nginx.conf.ejemplo` a tu sitio (por ejemplo `/etc/nginx/sites-available/fe-netstock`).
3. Activar el sitio y recargar nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/fe-netstock /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Asegurarte de que la app esté corriendo en el puerto 3000.

---

## Resumen

| Qué                | Puerto | Dónde        |
|--------------------|--------|-------------|
| App (Next.js)      | 3000   | 192.168.1.13 |
| Proxy (Caddy/nginx)| 80     | 192.168.1.13 |
| Router             | 80 → 192.168.1.13:80 |

Orden: **iniciar.bat** (app) y luego el proxy (Caddy o nginx).
