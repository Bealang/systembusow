const router = require('express').Router();

const pagesRouter = require('./pages');
const authRouter = require('./auth');
const newsRouter = require('./news');
const scheduleRouter = require('./schedule');
const pricingRouter = require('./pricing');
const faqRouter = require('./faq');
const attributesRouter = require('./attributes');

router.use(pagesRouter);
router.use(authRouter);
router.use(newsRouter);
router.use(scheduleRouter);
router.use(pricingRouter);
router.use(faqRouter);
router.use(attributesRouter);

module.exports = router;
