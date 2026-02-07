function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'listing-auth';
    overlay.className = 'listing-auth';
    overlay.innerHTML = `
    <div class="listing-auth-card" role="dialog" aria-modal="true" aria-labelledby="listing-auth-title">
      <h2 id="listing-auth-title">Sign In</h2>
      <p>Enter your username and password to continue.</p>
      <form id="listing-auth-form">
        <input id="listing-auth-user" type="text" placeholder="Username" autocomplete="username" />
        <input id="listing-auth-pass" type="password" placeholder="Password" autocomplete="current-password" />
        <button type="submit">Sign In</button>
      </form>
      <div id="listing-auth-error" class="listing-auth-error" hidden>Invalid credentials. Try again.</div>
    </div>
  `;
    document.body.appendChild(overlay);
    return overlay;
}
async function checkSession() {
    try {
        const res = await fetch('/api/session', { method: 'GET' });
        if (!res.ok)
            return false;
        const data = (await res.json());
        return Boolean(data.ok);
    }
    catch {
        return false;
    }
}
export function initListingAuth() {
    let overlay = document.getElementById('listing-auth');
    if (!overlay) {
        overlay = buildOverlay();
    }
    const form = overlay.querySelector('#listing-auth-form');
    const userInput = overlay.querySelector('#listing-auth-user');
    const passInput = overlay.querySelector('#listing-auth-pass');
    const errorEl = overlay.querySelector('#listing-auth-error');
    const open = () => {
        overlay?.classList.add('is-open');
        document.body.classList.add('auth-locked');
        if (userInput)
            userInput.focus();
    };
    const close = () => {
        overlay?.classList.remove('is-open');
        document.body.classList.remove('auth-locked');
    };
    void (async () => {
        const isAuthed = await checkSession();
        if (isAuthed) {
            close();
        }
        else {
            open();
        }
    })();
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (errorEl)
            errorEl.hidden = true;
        const username = userInput?.value.trim() ?? '';
        const password = passInput?.value ?? '';
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!res.ok) {
                if (errorEl)
                    errorEl.hidden = false;
                if (passInput)
                    passInput.value = '';
                return;
            }
            close();
        }
        catch {
            if (errorEl)
                errorEl.hidden = false;
            if (passInput)
                passInput.value = '';
        }
    });
}
