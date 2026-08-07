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

const router: IRouter = Router();

router.use(healthRouter);
router.use(moviesRouter);
router.use(reviewsRouter);
router.use(ratingsRouter);
router.use(watchlistRouter);
router.use(usersRouter);
router.use(professionalsRouter);
router.use(chatRouter);
router.use(animeRouter);
router.use(newsRouter);

export default router;
