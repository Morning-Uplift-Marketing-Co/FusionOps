import { api } from "./api";

export const leadingCardsApi = {
    async getCards(params = {}) {
        const query = new URLSearchParams(params).toString();
        const first = await api.get(`/lc/cards${query ? '?' + query : ''}`);
        // Auto-paginate: fetch remaining pages if total_pages > 1
        if (first?.total_pages > 1 && first?.results) {
            const all = [...first.results];
            for (let p = 2; p <= first.total_pages; p++) {
                try {
                    const next = await api.get(`/lc/cards?page=${p}${query ? '&' + query : ''}`);
                    if (next?.results) all.push(...next.results);
                } catch (_) { break; }
            }
            return { ...first, results: all, count: all.length };
        }
        return first;
    },
    async getCardDetail(uuid) {
        return api.get(`/lc/cards/${uuid}`);
    },
    async createCard(cardData) {
        return api.post('/lc/cards', cardData);
    },
    async blockCard(uuid) {
        return api.put(`/lc/cards/${uuid}/block`, {});
    },
    async activateCard(uuid) {
        return api.put(`/lc/cards/${uuid}/activate`, {});
    },
    async changeLimit(uuid, limit) {
        return api.put(`/lc/cards/${uuid}/change_limit`, { limit });
    },
    async getBins() {
        return api.get('/lc/bins');
    },
    async getBillingAddresses() {
        return api.get('/lc/billing');
    },
    async createBillingAddress(data) {
        return api.post('/lc/billing', data);
    },
    async getTags() {
        return api.get('/lc/tags');
    },
    async getTransactions(fromDate, toDate) {
        const params = new URLSearchParams();
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);
        const qs = params.toString();
        return api.get(`/lc/transactions${qs ? '?' + qs : ''}`);
    },
    async getTeams() {
        return api.get('/lc/teams');
    },
};
