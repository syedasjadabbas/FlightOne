import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./baseApi";

/**
 * Redux store — only wires RTK Query's `baseApi` (reducer + middleware).
 * There is deliberately no other Redux state: UI/app state lives in Zustand
 * (`/store`), server data lives in RTK Query's cache (dev guide §2/§4).
 */
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
