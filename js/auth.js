// auth.js - Kullanıcı kimlik doğrulama (kullanıcı adı ile)

const Auth = {
    login(username) {
        username = username.trim().toLowerCase();
        if (!username) return false;
        Storage.setCurrentUser(username);
        return true;
    },

    logout() {
        Storage.removeCurrentUser();
        window.location.href = 'index.html';
    },

    getCurrentUser() {
        return Storage.getCurrentUser();
    },

    isLoggedIn() {
        return !!this.getCurrentUser();
    },

    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
};
