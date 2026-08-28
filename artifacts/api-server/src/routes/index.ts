import { Router, type IRouter } from "express";
import healthRouter from "./health";
import moviesRouter from "./movies";
import reviewsRouter from "./reviews";
import ratingsRouter from "./ratings";
import watchlistRouter from "./watchlist";
import usersRouter from "./users";
import professionalsRouter from "./professionals";
import chatRouter from "./chat";
import animeRouter from "./anime";
import newsRouter from "./news";
import postsRouter from "./posts";
import adminSearchRouter from "./admin-search";
import profilesRouter from "./profiles";
import signalsRouter from "./signals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(moviesRouter);
router.use(reviewsRouter);
router.use(ratingsRouter);
router.use(watchlistRouter);
router.use(usersRouter);
router.use(profilesRouter);
router.use(signalsRouter);
router.use(professionalsRouter);
router.use(chatRouter);
router.use(animeRouter);
router.use(newsRouter);
router.use(postsRouter);
router.use(adminSearchRouter);

export default router;
