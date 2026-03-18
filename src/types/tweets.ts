export type TweetTone = "casual" | "professional" | "humorous";

export interface GeneratedTweet {
  text: string;
  tone: TweetTone;
  length: number;
}
