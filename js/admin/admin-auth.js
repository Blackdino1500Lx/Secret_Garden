/* ============================================================
   Estética Secret Garden — admin-auth.js
   Login con Supabase Auth + verificación de administrador.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.auth = (function () {
  'use strict';

  let sesion = null;
  let esAdminActual = false;

  // ------------------------------------------------------------
  // Verifica si el usuario logueado está en la tabla admins.
  // ------------------------------------------------------------
  async function verificarAdmin() {
    if (!SG.sb) return false;
    const { data, error } = await SG.sb.rpc('es_admin');
    if (error) {
      console.error('[SG.auth] es_admin error:', error);
      return false;
    }
    return data === true;
  }

  // ------------------------------------------------------------
  // Login con email + contraseña
  // ------------------------------------------------------------
  async function login(email, password) {
    if (!SG.sb) {
      throw new Error('Supabase no está configurado. Revisá js/config.js.');
    }

    const res = await SG.sb.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (res.error) {
      throw new Error(traducirError(res.error.message));
    }

    sesion = res.data.session;
    esAdminActual = await verificarAdmin();

    if (!esAdminActual) {
      await SG.sb.auth.signOut();
      sesion = null;
      throw new Error('Tu usuario no está autorizado como administrador.');
    }

    return sesion;
  }

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------
  async function logout() {
    if (SG.sb) {
      try { await SG.sb.auth.signOut(); } catch (_) { /* ignorar */ }
    }
    sesion = null;
    esAdminActual = false;
    mostrarLogin();
  }

  // ------------------------------------------------------------
  // Traducir errores de Supabase Auth
  // ------------------------------------------------------------
  function traducirError(msg) {
    const s = String(msg || '').toLowerCase();
    if (s.indexOf('invalid login') !== -1 || s.indexOf('invalid credentials') !== -1) {
      return 'Correo o contraseña incorrectos.';
    }
    if (s.indexOf('email not confirmed') !== -1) {
      return 'El correo aún no está confirmado.';
    }
    if (s.indexOf('too many requests') !== -1) {
      return 'Demasiados intentos. Esperá unos minutos.';
    }
    return 'No se pudo iniciar sesión. Intentá de nuevo.';
  }

  // ------------------------------------------------------------
  // Mostrar / ocultar pantallas
  // ------------------------------------------------------------
  function mostrarLogin() {
    const login = document.getElementById('admin-login');
    const app = document.getElementById('admin-app');
    if (login) login.style.display = '';
    if (app) app.hidden = true;
  }

  function mostrarApp() {
    const login = document.getElementById('admin-login');
    const app = document.getElementById('admin-app');
    if (login) login.style.display = 'none';
    if (app) app.hidden = false;
  }

  // ------------------------------------------------------------
  // Enganchar formulario de login
  // ------------------------------------------------------------
  function engancharFormulario() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const email = document.getElementById('login-email').value;
      const pass  = document.getElementById('login-pass').value;

      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
      if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

      try {
        await login(email, pass);
        mostrarApp();
        if (SG.admin.main && typeof SG.admin.main.onLogueado === 'function') {
          SG.admin.main.onLogueado();
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'Error al iniciar sesión.';
          errEl.hidden = false;
        }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
      }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        await logout();
      });
    }
  }

  // ------------------------------------------------------------
  // Init: revisar sesión existente
  // ------------------------------------------------------------
  async function init() {
    engancharFormulario();

    if (!SG.sb) {
      mostrarLogin();
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = 'Supabase no está configurado. Revisá js/config.js.';
        errEl.hidden = false;
      }
      return;
    }

    const res = await SG.sb.auth.getSession();
    const s = res.data && res.data.session;

    if (!s) {
      mostrarLogin();
      return;
    }

    sesion = s;
    esAdminActual = await verificarAdmin();

    if (!esAdminActual) {
      await SG.sb.auth.signOut();
      sesion = null;
      mostrarLogin();
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = 'Tu usuario no está autorizado como administrador.';
        errEl.hidden = false;
      }
      return;
    }

    mostrarApp();
    if (SG.admin.main && typeof SG.admin.main.onLogueado === 'function') {
      SG.admin.main.onLogueado();
    }
  }

    // ------------------------------------------------------------
  // Asegurar que la sesión esté fresca antes de queries privadas
  // ------------------------------------------------------------
  async function ensureSession() {
    if (!SG.sb) return false;
    const res = await SG.sb.auth.getSession();
    const session = res.data && res.data.session;
    if (!session) return false;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt && Date.now() > expiresAt - 60000) {
      try {
        const refresh = await SG.sb.auth.refreshSession();
        if (refresh.error) return false;
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  return {
    init: init,
    login: login,
    logout: logout,
    getSesion: function () { return sesion; },
    esAdmin: function () { return esAdminActual; },
    ensureSession: ensureSession          // ← nueva
  };
})();