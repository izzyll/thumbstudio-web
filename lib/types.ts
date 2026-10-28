// Shapes shared by the server routes and the browser.
export type Video = {
  id: string;
  title: string;
  publishedAt: string;
  seconds: number;
  views: number;
  likes: number | null;
  comments: number | null;
  outlierScore: number | null;
};

export type TopVideos = { channel: string; channelId: string; scanned: number; videos: Video[] };
