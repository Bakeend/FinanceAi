// Durante deploys na Square Cloud, setup+build do FinanceAi leva 30-90s.
// Sem este bootstrap, a porta fica ocupada por nada e o usuário vê a tela de
// timeout do Square Cloud. Este script sobe um HTTP server mínimo na porta
// publica com uma tela "atualizando...", roda o build, e passa a porta
// pro backend real quando termina.

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = Number(process.env.PORT) || 3001;

const MAINT_HTML = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="refresh" content="15" />
<title>Atualizando — FinanceAi</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#0a0f1e;color:#e2e8f0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:420px;width:100%;background:#111827;border:1px solid #1f2937;border-radius:20px;padding:32px 28px;box-shadow:0 10px 40px rgba(0,0,0,.4);text-align:center}
.pulse{width:56px;height:56px;margin:0 auto 20px;border-radius:16px;background:linear-gradient(135deg,#7c5cff,#4cc9f0);box-shadow:0 0 32px rgba(124,92,255,.5);animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.9);opacity:.7}}
h1{font-size:22px;font-weight:700;margin-bottom:8px}
.brand{background:linear-gradient(135deg,#7c5cff,#4cc9f0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
p{font-size:14px;color:#94a3b8;line-height:1.5;margin-top:8px}
.hint{margin-top:18px;font-size:12px;color:#64748b}
</style>
</head>
<body>
<div class="card">
<div class="pulse"></div>
<h1>Finance<span class="brand">Ai</span> atualizando…</h1>
<p>Estamos instalando uma nova versão. Volte em alguns segundos.</p>
<p class="hint">A página recarrega sozinha.</p>
</div>
</body>
</html>`;

const maint = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '15' });
    res.end(JSON.stringify({ ok: false, status: 'updating' }));
    return;
  }
  res.writeHead(503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Retry-After': '15',
    'Cache-Control': 'no-store',
  });
  res.end(MAINT_HTML);
});

maint.listen(PORT, '0.0.0.0', () => {
  console.log(`[bootstrap] maintenance server on :${PORT}`);
  runBuild();
});

function runBuild() {
  console.log('[bootstrap] setup + build iniciando…');
  const build = spawn('sh', ['-c', 'npm run setup && npm run build'], {
    stdio: 'inherit',
    env: process.env,
  });
  build.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[bootstrap] build falhou (code ${code}). Maintenance server segue no ar.`);
      return;
    }
    handover();
  });
}

function handover() {
  console.log('[bootstrap] fechando maintenance server…');
  maint.close(() => {
    console.log('[bootstrap] iniciando backend…');
    const backend = spawn('node', [path.join('backend', 'dist', 'main')], {
      stdio: 'inherit',
      env: process.env,
    });
    backend.on('exit', (code) => process.exit(code ?? 0));
    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.on(sig, () => backend.kill(sig));
    }
  });
}
