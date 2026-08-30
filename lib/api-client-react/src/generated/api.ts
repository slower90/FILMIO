r = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof cancelFriendRequest>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof cancelFriendRequest>>, TError,{id: number}, TContext> => {

const mutationKey = ['cancelFriendRequest'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof cancelFriendRequest>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  cancelFriendRequest(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CancelFriendRequestMutationResult = NonNullable<Awaited<ReturnType<typeof cancelFriendRequest>>>

    export type CancelFriendRequestMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Cancel a sent friend request
 */
export const useCancelFriendRequest = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof cancelFriendRequest>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof cancelFriendRequest>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getCancelFriendRequestMutationOptions(options));
    }

export const getDeclineFriendRequestUrl = (id: number,) => {




  return `/api/users/friend-requests/${id}/decline`
}

/**
 * @summary Decline an incoming friend request
 */
export const declineFriendRequest = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<void> => {

  return customFetch<void>(getDeclineFriendRequestUrl(id),
  {
    ...options,
    method: 'POST'


  }
);}





export const getDeclineFriendRequestMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof declineFriendRequest>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof declineFriendRequest>>, TError,{id: number}, TContext> => {

const mutationKey = ['declineFriendRequest'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof declineFriendRequest>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  declineFriendRequest(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeclineFriendRequestMutationResult = NonNullable<Awaited<ReturnType<typeof declineFriendRequest>>>

    export type DeclineFriendRequestMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Decline an incoming friend request
 */
export const useDeclineFriendRequest = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof declineFriendRequest>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof declineFriendRequest>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getDeclineFriendRequestMutationOptions(options));
    }

export const getUnfriendUserUrl = (id: number,) => {




  return `/api/users/${id}/friend`
}

/**
 * @summary Remove an existing friendship
 */
export const unfriendUser = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<void> => {

  return customFetch<void>(getUnfriendUserUrl(id),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getUnfriendUserMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof unfriendUser>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof unfriendUser>>, TError,{id: number}, TContext> => {

const mutationKey = ['unfriendUser'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof unfriendUser>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  unfriendUser(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UnfriendUserMutationResult = NonNullable<Awaited<ReturnType<typeof unfriendUser>>>

    export type UnfriendUserMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Remove an existing friendship
 */
export const useUnfriendUser = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof unfriendUser>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof unfriendUser>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getUnfriendUserMutationOptions(options));
    }

export const getCreatePostUrl = () => {




  return `/api/posts`
}

/**
 * @summary Create a movie-community social post
 */
export const createPost = async (postInput: PostInput, options?: Parameters<typeof customFetch>[1]): Promise<Post> => {

  return customFetch<Post>(getCreatePostUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(postInput)
  }
);}





export const getCreatePostMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createPost>>, TError,{data: BodyType<PostInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createPost>>, TError,{data: BodyType<PostInput>}, TContext> => {

const mutationKey = ['createPost'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createPost>>, {data: BodyType<PostInput>}> = (props) => {
          const {data} = props ?? {};

          return  createPost(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreatePostMutationResult = NonNullable<Awaited<ReturnType<typeof createPost>>>
    export type CreatePostMutationBody = BodyType<PostInput>
    export type CreatePostMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Create a movie-community social post
 */
export const useCreatePost = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createPost>>, TError,{data: BodyType<PostInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createPost>>,
        TError,
        {data: BodyType<PostInput>},
        TContext
      > => {
      return useMutation(getCreatePostMutationOptions(options));
    }

export const getGetPostsFeedUrl = (params?: GetPostsFeedParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/posts/feed?${stringifiedParams}` : `/api/posts/feed`
}

/**
 * @summary Get the authenticated movie-community social feed
 */
export const getPostsFeed = async (params?: GetPostsFeedParams, options?: Parameters<typeof customFetch>[1]): Promise<PostFeedResponse> => {

  return customFetch<PostFeedResponse>(getGetPostsFeedUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPostsFeedQueryKey = (params?: GetPostsFeedParams,) => {
    return [
    `/api/posts/feed`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetPostsFeedQueryOptions = <TData = Awaited<ReturnType<typeof getPostsFeed>>, TError = ErrorType<ErrorResponse>>(params?: GetPostsFeedParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPostsFeed>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPostsFeedQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPostsFeed>>> = ({ signal }) => getPostsFeed(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPostsFeed>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPostsFeedQueryResult = NonNullable<Awaited<ReturnType<typeof getPostsFeed>>>
export type GetPostsFeedQueryError = ErrorType<ErrorResponse>


/**
 * @summary Get the authenticated movie-community social feed
 */

export function useGetPostsFeed<TData = Awaited<ReturnType<typeof getPostsFeed>>, TError = ErrorType<ErrorResponse>>(
 params?: GetPostsFeedParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPostsFeed>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPostsFeedQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getRequestPostUploadUrl = () => {




  return `/api/posts/upload-url`
}

/**
 * @summary Request a private social post image upload URL
 */
export const requestPostUpload = async (postUploadInput: PostUploadInput, options?: Parameters<typeof customFetch>[1]): Promise<PostUploadResponse> => {

  return customFetch<PostUploadResponse>(getRequestPostUploadUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(postUploadInput)
  }
);}





export const getRequestPostUploadMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestPostUpload>>, TError,{data: BodyType<PostUploadInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof requestPostUpload>>, TError,{data: BodyType<PostUploadInput>}, TContext> => {

const mutationKey = ['requestPostUpload'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof requestPostUpload>>, {data: BodyType<PostUploadInput>}> = (props) => {
          const {data} = props ?? {};

          return  requestPostUpload(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RequestPostUploadMutationResult = NonNullable<Awaited<ReturnType<typeof requestPostUpload>>>
    export type RequestPostUploadMutationBody = BodyType<PostUploadInput>
    export type RequestPostUploadMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Request a private social post image upload URL
 */
export const useRequestPostUpload = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestPostUpload>>, TError,{data: BodyType<PostUploadInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof requestPostUpload>>,
        TError,
        {data: BodyType<PostUploadInput>},
        TContext
      > => {
      return useMutation(getRequestPostUploadMutationOptions(options));
    }

export const getLikePostUrl = (id: number,) => {




  return `/api/posts/${id}/like`
}

/**
 * @summary Like a social post
 */
export const likePost = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<PostLikeResponse> => {

  return customFetch<PostLikeResponse>(getLikePostUrl(id),
  {
    ...options,
    method: 'POST'


  }
);}





export const getLikePostMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof likePost>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof likePost>>, TError,{id: number}, TContext> => {

const mutationKey = ['likePost'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof likePost>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  likePost(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type LikePostMutationResult = NonNullable<Awaited<ReturnType<typeof likePost>>>

    export type LikePostMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Like a social post
 */
export const useLikePost = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof likePost>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof likePost>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getLikePostMutationOptions(options));
    }

export const getUnlikePostUrl = (id: number,) => {




  return `/api/posts/${id}/like`
}

/**
 * @summary Unlike a social post
 */
export const unlikePost = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<PostLikeResponse> => {

  return customFetch<PostLikeResponse>(getUnlikePostUrl(id),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getUnlikePostMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof unlikePost>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof unlikePost>>, TError,{id: number}, TContext> => {

const mutationKey = ['unlikePost'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof unlikePost>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  unlikePost(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UnlikePostMutationResult = NonNullable<Awaited<ReturnType<typeof unlikePost>>>

    export type UnlikePostMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Unlike a social post
 */
export const useUnlikePost = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof unlikePost>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof unlikePost>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getUnlikePostMutationOptions(options));
    }

export const getListPostCommentsUrl = (id: number,) => {




  return `/api/posts/${id}/comments`
}

/**
 * @summary List comments on a social post
 */
export const listPostComments = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<PostComment[]> => {

  return customFetch<PostComment[]>(getListPostCommentsUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListPostCommentsQueryKey = (id: number,) => {
    return [
    `/api/posts/${id}/comments`
    ] as const;
    }


export const getListPostCommentsQueryOptions = <TData = Awaited<ReturnType<typeof listPostComments>>, TError = ErrorType<ErrorResponse>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listPostComments>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListPostCommentsQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listPostComments>>> = ({ signal }) => listPostComments(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listPostComments>>, TError, TData> & { queryKey: QueryKey }
}

export type ListPostCommentsQueryResult = NonNullable<Awaited<ReturnType<typeof listPostComments>>>
export type ListPostCommentsQueryError = ErrorType<ErrorResponse>


/**
 * @summary List comments on a social post
 */

export function useListPostComments<TData = Awaited<ReturnType<typeof listPostComments>>, TError = ErrorType<ErrorResponse>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listPostComments>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListPostCommentsQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreatePostCommentUrl = (id: number,) => {




  return `/api/posts/${id}/comments`
}

/**
 * @summary Add a comment to a social post
 */
export const createPostComment = async (id: number,
    postCommentInput: PostCommentInput, options?: Parameters<typeof customFetch>[1]): Promise<PostComment> => {

  return customFetch<PostComment>(getCreatePostCommentUrl(id),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(postCommentInput)
  }
);}





export const getCreatePostCommentMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createPostComment>>, TError,{id: number;data: BodyType<PostCommentInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createPostComment>>, TError,{id: number;data: BodyType<PostCommentInput>}, TContext> => {

const mutationKey = ['createPostComment'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createPostComment>>, {id: number;data: BodyType<PostCommentInput>}> = (props) => {
          const {id,data} = props ?? {};

          return  createPostComment(id,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreatePostCommentMutationResult = NonNullable<Awaited<ReturnType<typeof createPostComment>>>
    export type CreatePostCommentMutationBody = BodyType<PostCommentInput>
    export type CreatePostCommentMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Add a comment to a social post
 */
export const useCreatePostComment = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createPostComment>>, TError,{id: number;data: BodyType<PostCommentInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createPostComment>>,
        TError,
        {id: number;data: BodyType<PostCommentInput>},
        TContext
      > => {
      return useMutation(getCreatePostCommentMutationOptions(options));
    }

export const getGetStoriesUrl = () => {




  return `/api/stories`
}

/**
 * @summary Get active temporary stories
 */
export const getStories = async ( options?: Parameters<typeof customFetch>[1]): Promise<Story[]> => {

  return customFetch<Story[]>(getGetStoriesUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetStoriesQueryKey = () => {
    return [
    `/api/stories`
    ] as const;
    }


export const getGetStoriesQueryOptions = <TData = Awaited<ReturnType<typeof getStories>>, TError = ErrorType<ErrorResponse>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStories>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetStoriesQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getStories>>> = ({ signal }) => getStories({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getStories>>, TError, TData> & { queryKey: QueryKey }
}

export type GetStoriesQueryResult = NonNullable<Awaited<ReturnType<typeof getStories>>>
export type GetStoriesQueryError = ErrorType<ErrorResponse>


/**
 * @summary Get active temporary stories
 */

export function useGetStories<TData = Awaited<ReturnType<typeof getStories>>, TError = ErrorType<ErrorResponse>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStories>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetStoriesQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateStoryUrl = () => {




  return `/api/stories`
}

/**
 * @summary Create a temporary story
 */
export const createStory = async (storyInput: StoryInput, options?: Parameters<typeof customFetch>[1]): Promise<Story> => {

  return customFetch<Story>(getCreateStoryUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(storyInput)
  }
);}





export const getCreateStoryMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createStory>>, TError,{data: BodyType<StoryInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createStory>>, TError,{data: BodyType<StoryInput>}, TContext> => {

const mutationKey = ['createStory'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createStory>>, {data: BodyType<StoryInput>}> = (props) => {
          const {data} = props ?? {};

          return  createStory(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateStoryMutationResult = NonNullable<Awaited<ReturnType<typeof createStory>>>
    export type CreateStoryMutationBody = BodyType<StoryInput>
    export type CreateStoryMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Create a temporary story
 */
export const useCreateStory = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createStory>>, TError,{data: BodyType<StoryInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createStory>>,
        TError,
        {data: BodyType<StoryInput>},
        TContext
      > => {
      return useMutation(getCreateStoryMutationOptions(options));
    }

export const getRequestStoryUploadUrl = () => {




  return `/api/stories/upload-url`
}

/**
 * @summary Request a private story media upload URL
 */
export const requestStoryUpload = async (storyUploadInput: StoryUploadInput, options?: Parameters<typeof customFetch>[1]): Promise<StoryUploadResponse> => {

  return customFetch<StoryUploadResponse>(getRequestStoryUploadUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(storyUploadInput)
  }
);}





export const getRequestStoryUploadMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestStoryUpload>>, TError,{data: BodyType<StoryUploadInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof requestStoryUpload>>, TError,{data: BodyType<StoryUploadInput>}, TContext> => {

const mutationKey = ['requestStoryUpload'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof requestStoryUpload>>, {data: BodyType<StoryUploadInput>}> = (props) => {
          const {data} = props ?? {};

          return  requestStoryUpload(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RequestStoryUploadMutationResult = NonNullable<Awaited<ReturnType<typeof requestStoryUpload>>>
    export type RequestStoryUploadMutationBody = BodyType<StoryUploadInput>
    export type RequestStoryUploadMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Request a private story media upload URL
 */
export const useRequestStoryUpload = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestStoryUpload>>, TError,{data: BodyType<StoryUploadInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof requestStoryUpload>>,
        TError,
        {data: BodyType<StoryUploadInput>},
        TContext
      > => {
      return useMutation(getRequestStoryUploadMutationOptions(options));
    }

export const getDeleteStoryUrl = (id: number,) => {




  return `/api/stories/${id}`
}

/**
 * @summary Delete your temporary story
 */
export const deleteStory = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<void> => {

  return customFetch<void>(getDeleteStoryUrl(id),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getDeleteStoryMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteStory>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteStory>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteStory'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteStory>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteStory(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeleteStoryMutationResult = NonNullable<Awaited<ReturnType<typeof deleteStory>>>

    export type DeleteStoryMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Delete your temporary story
 */
export const useDeleteStory = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteStory>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof deleteStory>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getDeleteStoryMutationOptions(options));
    }

export const getGetStoryMediaUrl = (id: number,) => {




  return `/api/stories/${id}/media`
}

/**
 * @summary Get active story media
 */
export const getStoryMedia = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<unknown> => {

  return customFetch<unknown>(getGetStoryMediaUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetStoryMediaQueryKey = (id: number,) => {
    return [
    `/api/stories/${id}/media`
    ] as const;
    }


export const getGetStoryMediaQueryOptions = <TData = Awaited<ReturnType<typeof getStoryMedia>>, TError = ErrorType<void | ErrorResponse>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStoryMedia>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetStoryMediaQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getStoryMedia>>> = ({ signal }) => getStoryMedia(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getStoryMedia>>, TError, TData> & { queryKey: QueryKey }
}

export type GetStoryMediaQueryResult = NonNullable<Awaited<ReturnType<typeof getStoryMedia>>>
export type GetStoryMediaQueryError = ErrorType<void | ErrorResponse>


/**
 * @summary Get active story media
 */

export function useGetStoryMedia<TData = Awaited<ReturnType<typeof getStoryMedia>>, TError = ErrorType<void | ErrorResponse>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStoryMedia>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetStoryMediaQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetFeedUrl = (params?: GetFeedParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/feed?${stringifiedParams}` : `/api/feed`
}

/**
 * @summary Social feed of reviews from followed users
 */
export const getFeed = async (params?: GetFeedParams, options?: Parameters<typeof customFetch>[1]): Promise<Review[]> => {

  return customFetch<Review[]>(getGetFeedUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetFeedQueryKey = (params?: GetFeedParams,) => {
    return [
    `/api/feed`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetFeedQueryOptions = <TData = Awaited<ReturnType<typeof getFeed>>, TError = ErrorType<ErrorResponse>>(params?: GetFeedParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getFeed>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetFeedQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getFeed>>> = ({ signal }) => getFeed(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getFeed>>, TError, TData> & { queryKey: QueryKey }
}

export type GetFeedQueryResult = NonNullable<Awaited<ReturnType<typeof getFeed>>>
export type GetFeedQueryError = ErrorType<ErrorResponse>


/**
 * @summary Social feed of reviews from followed users
 */

export function useGetFeed<TData = Awaited<ReturnType<typeof getFeed>>, TError = ErrorType<ErrorResponse>>(
 params?: GetFeedParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getFeed>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetFeedQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetRecommendationsUrl = (params?: GetRecommendationsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/recommendations?${stringifiedParams}` : `/api/recommendations`
}

/**
 * @summary Personalized movie recommendations
 */
export const getRecommendations = async (params?: GetRecommendationsParams, options?: Parameters<typeof customFetch>[1]): Promise<MovieSummary[]> => {

  return customFetch<MovieSummary[]>(getGetRecommendationsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetRecommendationsQueryKey = (params?: GetRecommendationsParams,) => {
    return [
    `/api/recommendations`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetRecommendationsQueryOptions = <TData = Awaited<ReturnType<typeof getRecommendations>>, TError = ErrorType<unknown>>(params?: GetRecommendationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecommendations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetRecommendationsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getRecommendations>>> = ({ signal }) => getRecommendations(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getRecommendations>>, TError, TData> & { queryKey: QueryKey }
}

export type GetRecommendationsQueryResult = NonNullable<Awaited<ReturnType<typeof getRecommendations>>>
export type GetRecommendationsQueryError = ErrorType<unknown>


/**
 * @summary Personalized movie recommendations
 */

export function useGetRecommendations<TData = Awaited<ReturnType<typeof getRecommendations>>, TError = ErrorType<unknown>>(
 params?: GetRecommendationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecommendations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetRecommendationsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetSurprisePickUrl = (params: GetSurprisePickParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/surprise-me?${stringifiedParams}` : `/api/surprise-me`
}

/**
 * @summary Choose one explainable film for a discovery lens
 */
export const getSurprisePick = async (params: GetSurprisePickParams, options?: Parameters<typeof customFetch>[1]): Promise<SurprisePick> => {

  return customFetch<SurprisePick>(getGetSurprisePickUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetSurprisePickQueryKey = (params?: GetSurprisePickParams,) => {
    return [
    `/api/surprise-me`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetSurprisePickQueryOptions = <TData = Awaited<ReturnType<typeof getSurprisePick>>, TError = ErrorType<ErrorResponse>>(params: GetSurprisePickParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getSurprisePick>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetSurprisePickQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getSurprisePick>>> = ({ signal }) => getSurprisePick(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getSurprisePick>>, TError, TData> & { queryKey: QueryKey }
}

export type GetSurprisePickQueryResult = NonNullable<Awaited<ReturnType<typeof getSurprisePick>>>
export type GetSurprisePickQueryError = ErrorType<ErrorResponse>


/**
 * @summary Choose one explainable film for a discovery lens
 */

export function useGetSurprisePick<TData = Awaited<ReturnType<typeof getSurprisePick>>, TError = ErrorType<ErrorResponse>>(
 params: GetSurprisePickParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getSurprisePick>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetSurprisePickQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetMyProfessionalProfileUrl = () => {




  return `/api/professionals/me`
}

/**
 * @summary Get my professional profile
 */
export const getMyProfessionalProfile = async ( options?: Parameters<typeof customFetch>[1]): Promise<ProfessionalProfile> => {

  return customFetch<ProfessionalProfile>(getGetMyProfessionalProfileUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetMyProfessionalProfileQueryKey = () => {
    return [
    `/api/professionals/me`
    ] as const;
    }


export const getGetMyProfessionalProfileQueryOptions = <TData = Awaited<ReturnType<typeof getMyProfessionalProfile>>, TError = ErrorType<ErrorResponse>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMyProfessionalProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetMyProfessionalProfileQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMyProfessionalProfile>>> = ({ signal }) => getMyProfessionalProfile({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMyProfessionalProfile>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMyProfessionalProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getMyProfessionalProfile>>>
export type GetMyProfessionalProfileQueryError = ErrorType<ErrorResponse>


/**
 * @summary Get my professional profile
 */

export function useGetMyProfessionalProfile<TData = Awaited<ReturnType<typeof getMyProfessionalProfile>>, TError = ErrorType<ErrorResponse>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMyProfessionalProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetMyProfessionalProfileQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateProfessionalProfileUrl = () => {




  return `/api/professionals/me`
}

/**
 * @summary Create professional profile
 */
export const createProfessionalProfile = async (professionalProfileInput: ProfessionalProfileInput, options?: Parameters<typeof customFetch>[1]): Promise<ProfessionalProfile> => {

  return customFetch<ProfessionalProfile>(getCreateProfessionalProfileUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(professionalProfileInput)
  }
);}





export const getCreateProfessionalProfileMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createProfessionalProfile>>, TError,{data: BodyType<ProfessionalProfileInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createProfessionalProfile>>, TError,{data: BodyType<ProfessionalProfileInput>}, TContext> => {

const mutationKey = ['createProfessionalProfile'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createProfessionalProfile>>, {data: BodyType<ProfessionalProfileInput>}> = (props) => {
          const {data} = props ?? {};

          return  createProfessionalProfile(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateProfessionalProfileMutationResult = NonNullable<Awaited<ReturnType<typeof createProfessionalProfile>>>
    export type CreateProfessionalProfileMutationBody = BodyType<ProfessionalProfileInput>
    export type CreateProfessionalProfileMutationError = ErrorType<ErrorResponse>

    /**
 * @summary Create professional profile
 */
export const useCreateProfessionalProfile = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createProfessionalProfile>>, TError,{data: BodyType<ProfessionalProfileInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createProfessionalProfile>>,
        TError,
        {data: BodyType<ProfessionalProfileInput>},
        TContext
      > => {
      return useMutation(getCreateProfessionalProfileMutationOptions(options));
    }

export const getUpdateProfessionalProfileUrl = () => {




  return `/api/professionals/me`
}

/**
 * @summary Update professional profile
 */
export const updateProfessionalProfile = async (professionalProfileUpdate: ProfessionalProfileUpdate, options?: Parameters<typeof customFetch>[1]): Promise<ProfessionalProfile> => {

  return customFetch<ProfessionalProfile>(getUpdateProfessionalProfileUrl(),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(professionalProfileUpdate)
  }
);}





export const getUpdateProfessionalProfileMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateProfessionalProfile>>, TError,{data: BodyType<ProfessionalProfileUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateProfessionalProfile>>, TError,{data: BodyType<ProfessionalProfileUpdate>}, TContext> => {

const mutationKey = ['updateProfessionalProfile'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateProfessionalProfile>>, {data: BodyType<ProfessionalProfileUpdate>}> = (props) => {
          const {data} = props ?? {};

          return  updateProfessionalProfile(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateProfessionalProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateProfessionalProfile>>>
    export type UpdateProfessionalProfileMutationBody = BodyType<ProfessionalProfileUpdate>
    export type UpdateProfessionalProfileMutationError = ErrorType<unknown>

    /**
 * @summary Update professional profile
 */
export const useUpdateProfessionalProfile = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateProfessionalProfile>>, TError,{data: BodyType<ProfessionalProfileUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateProfessionalProfile>>,
        TError,
        {data: BodyType<ProfessionalProfileUpdate>},
        TContext
      > => {
      return useMutation(getUpdateProfessionalProfileMutationOptions(options));
    }

export const getSearchProfessionalsUrl = (params?: SearchProfessionalsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/professionals/search?${stringifiedParams}` : `/api/professionals/search`
}

/**
 * @summary Search industry professionals
 */
export const searchProfessionals = async (params?: SearchProfessionalsParams, options?: Parameters<typeof customFetch>[1]): Promise<ProfessionalProfile[]> => {

  return customFetch<ProfessionalProfile[]>(getSearchProfessionalsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getSearchProfessionalsQueryKey = (params?: SearchProfessionalsParams,) => {
    return [
    `/api/professionals/search`, ...(params ? [params] : [])
    ] as const;
    }


export const getSearchProfessionalsQueryOptions = <TData = Awaited<ReturnType<typeof searchProfessionals>>, TError = ErrorType<unknown>>(params?: SearchProfessionalsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof searchProfessionals>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getSearchProfessionalsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof searchProfessionals>>> = ({ signal }) => searchProfessionals(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof searchProfessionals>>, TError, TData> & { queryKey: QueryKey }
}

export type SearchProfessionalsQueryResult = NonNullable<Awaited<ReturnType<typeof searchProfessionals>>>
export type SearchProfessionalsQueryError = ErrorType<unknown>


/**
 * @summary Search industry professionals
 */

export function useSearchProfessionals<TData = Awaited<ReturnType<typeof searchProfessionals>>, TError = ErrorType<unknown>>(
 params?: SearchProfessionalsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof searchProfessionals>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getSearchProfessionalsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetProfessionalProfileUrl = (id: number,) => {




  return `/api/professionals/${id}`
}

/**
 * @summary Get a professional's public profile
 */
export const getProfessionalProfile = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<ProfessionalProfile> => {

  return customFetch<ProfessionalProfile>(getGetProfessionalProfileUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetProfessionalProfileQueryKey = (id: number,) => {
    return [
    `/api/professionals/${id}`
    ] as const;
    }


export const getGetProfessionalProfileQueryOptions = <TData = Awaited<ReturnType<typeof getProfessionalProfile>>, TError = ErrorType<ErrorResponse>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getProfessionalProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetProfessionalProfileQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getProfessionalProfile>>> = ({ signal }) => getProfessionalProfile(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getProfessionalProfile>>, TError, TData> & { queryKey: QueryKey }
}

export type GetProfessionalProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getProfessionalProfile>>>
export type GetProfessionalProfileQueryError = ErrorType<ErrorResponse>


/**
 * @summary Get a professional's public profile
 */

export function useGetProfessionalProfile<TData = Awaited<ReturnType<typeof getProfessionalProfile>>, TError = ErrorType<ErrorResponse>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getProfessionalProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetProfessionalProfileQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListConversationsUrl = () => {




  return `/api/chat/conversations`
}

/**
 * @summary List my conversations
 */
export const listConversations = async ( options?: Parameters<typeof customFetch>[1]): Promise<Conversation[]> => {

  return customFetch<Conversation[]>(getListConversationsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListConversationsQueryKey = () => {
    return [
    `/api/chat/conversations`
    ] as const;
    }


export const getListConversationsQueryOptions = <TData = Awaited<ReturnType<typeof listConversations>>, TError = ErrorType<ErrorResponse>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListConversationsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listConversations>>> = ({ signal }) => listConversations({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData> & { queryKey: QueryKey }
}

export type ListConversationsQueryResult = NonNullable<Awaited<ReturnType<typeof listConversations>>>
export type ListConversationsQueryError = ErrorType<ErrorResponse>


/**
 * @summary List my conversations
 */

export function useListConversations<TData = Awaited<ReturnType<typeof listConversations>>, TError = ErrorType<ErrorResponse>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListConversationsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateConversationUrl = () => {




  return `/api/chat/conversations`
}

/**
 * @summary Start a new conversation
 */
export const createConversation = async (conversationInput: ConversationInput, options?: Parameters<typeof customFetch>[1]): Promise<Conversation> => {

  return customFetch<Conversation>(getCreateConversationUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(conversationInput)
  }
);}





export const getCreateConversationMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createConversation>>, TError,{data: BodyType<ConversationInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createConversation>>, TError,{data: BodyType<ConversationInput>}, TContext> => {

const mutationKey = ['createConversation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createConversation>>, {data: BodyType<ConversationInput>}> = (props) => {
          const {data} = props ?? {};

          return  createConversation(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateConversationMutationResult = NonNullable<Awaited<ReturnType<typeof createConversation>>>
    export type CreateConversationMutationBody = BodyType<ConversationInput>
    export type CreateConversationMutationError = ErrorType<unknown>

    /**
 * @summary Start a new conversation
 */
export const useCreateConversation = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createConversation>>, TError,{data: BodyType<ConversationInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createConversation>>,
        TError,
        {data: BodyType<ConversationInput>},
        TContext
      > => {
      return useMutation(getCreateConversationMutationOptions(options));
    }

export const getListMessagesUrl = (id: number,) => {




  return `/api/chat/conversations/${id}/messages`
}

/**
 * @summary Get messages in a conversation
 */
export const listMessages = async (id: number, options?: Parameters<typeof customFetch>[1]): Promise<ChatMessage[]> => {

  return customFetch<ChatMessage[]>(getListMessagesUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListMessagesQueryKey = (id: number,) => {
    return [
    `/api/chat/conversations/${id}/messages`
    ] as const;
    }


export const getListMessagesQueryOptions = <TData = Awaited<ReturnType<typeof listMessages>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMessages>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListMessagesQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listMessages>>> = ({ signal }) => listMessages(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listMessages>>, TError, TData> & { queryKey: QueryKey }
}

export type ListMessagesQueryResult = NonNullable<Awaited<ReturnType<typeof listMessages>>>
export type ListMessagesQueryError = ErrorType<unknown>


/**
 * @summary Get messages in a conversation
 */

export function useListMessages<TData = Awaited<ReturnType<typeof listMessages>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMessages>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListMessagesQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getSendMessageUrl = (id: number,) => {




  return `/api/chat/conversations/${id}/messages`
}

/**
 * @summary Send a message
 */
export const sendMessage = async (id: number,
    chatMessageInput: ChatMessageInput, options?: Parameters<typeof customFetch>[1]): Promise<ChatMessage> => {

  return customFetch<ChatMessage>(getSendMessageUrl(id),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(chatMessageInput)
  }
);}





export const getSendMessageMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof sendMessage>>, TError,{id: number;data: BodyType<ChatMessageInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof sendMessage>>, TError,{id: number;data: BodyType<ChatMessageInput>}, TContext> => {

const mutationKey = ['sendMessage'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof sendMessage>>, {id: number;data: BodyType<ChatMessageInput>}> = (props) => {
          const {id,data} = props ?? {};

          return  sendMessage(id,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type SendMessageMutationResult = NonNullable<Awaited<ReturnType<typeof sendMessage>>>
    export type SendMessageMutationBody = BodyType<ChatMessageInput>
    export type SendMessageMutationError = ErrorType<unknown>

    /**
 * @summary Send a message
 */
export const useSendMessage = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof sendMessage>>, TError,{id: number;data: BodyType<ChatMessageInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof sendMessage>>,
        TError,
        {id: number;data: BodyType<ChatMessageInput>},
        TContext
      > => {
      return useMutation(getSendMessageMutationOptions(options));
    }

