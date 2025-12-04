export default class Router {
    constructor(routes, onRoute) {
        this.routes = routes;
        this.onRoute = onRoute;
        this.init();
    }
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute(); 
    }
    handleRoute() {
        // Handle query parameters in hash (e.g., #editor?id=1)
        let hash = window.location.hash.slice(1) || 'editor';
        let query = {};
        
        if (hash.includes('?')) {
            const parts = hash.split('?');
            hash = parts[0];
            const params = new URLSearchParams(parts[1]);
            for (const [key, value] of params) {
                query[key] = value;
            }
        }

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        const view = document.getElementById(`view-${hash}`);
        if (view) view.classList.add('active');
        
        const link = document.querySelector(`.nav-link[data-link="${hash}"]`);
        if (link) link.classList.add('active');

        if (this.onRoute) this.onRoute(hash, query);
    }
    navigate(path) { window.location.hash = path; }
}