type InstagramPostBase = {
  readonly id: string;
  readonly permalink: string;
  readonly caption: string | undefined;
};

export type InstagramImagePost = InstagramPostBase & {
  readonly mediaType: "image";
  readonly imageUrl: string;
};

export type InstagramVideoPost = InstagramPostBase & {
  readonly mediaType: "video";
  readonly videoUrl: string;
  readonly thumbnailUrl: string;
};

export type InstagramPost = InstagramImagePost | InstagramVideoPost;
