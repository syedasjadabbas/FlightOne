import { baseApi } from "@/lib/api/baseApi";

export const newsletterApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    subscribeToNewsletter: build.mutation<{ email: string }, { email: string }>({
      query: (body) => ({ url: "/newsletter/subscribe", method: "POST", body }),
    }),
  }),
});

export const { useSubscribeToNewsletterMutation } = newsletterApi;
