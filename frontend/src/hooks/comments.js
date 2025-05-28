import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { backendFetch } from "../backend";

const PAGE_SIZE = 20;

export function useComments({ fileId }) {
  return useInfiniteQuery({
    queryKey: ["comments", fileId],
    queryFn: async ({ pageParam = 0 }) => {
      return backendFetch(
        `/comments?fileId=${fileId}&limit=${PAGE_SIZE}&offset=${pageParam}`,
      );
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length * PAGE_SIZE;
      }
      return undefined;
    },
    initialPageParam: 0,
  });
}

export function useCreateComment({ fileId }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, x, y, parentId }) =>
      backendFetch("/comments", {
        method: "POST",
        body: JSON.stringify({ fileId, body, x, y, parentId }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (comment) => {
      queryClient.setQueryData(["comments", fileId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page, index) => {
            if (index === 0) {
              return {
                ...page,
                comments: [comment, ...page.comments],
              };
            }
            return page;
          }),
        };
      });
    },
  });
}
