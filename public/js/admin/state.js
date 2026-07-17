// Centralny stan aplikacji admin — zamiast rozproszonych let globals
const state = {
    fullScheduleData: null,
    editingNewsId: null,
    allStops: [],
    allPrices: [],
    allFaqs: [],
    allAttributes: [],
    editingFaqId: null,
    editingAttrSymbol: null,
    isMonthlyManuallyEdited: false,
    isMonthlyDiscountManuallyEdited: false,
    currentAdminNewsPage: 1,
    allLoadedAdminNews: [],
    quill: null,
};

export default state;
