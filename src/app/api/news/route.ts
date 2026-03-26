/**
 * API Route: /api/news
 *
 * Fetches London news headlines from the BBC News RSS feed.
 * Parses the XML and returns a simple array of headlines
 * for the news ticker on the home page.
 *
 * No API key needed — BBC RSS feeds are freely available.
 * Cached for 15 minutes to avoid excessive requests.
 *
 * Returns:
 *   [{ title: "Headline text", link: "https://...", pubDate: "Mon, 26 Mar..." }]
 */

import { NextResponse } from "next/server";

/** BBC News London RSS feed URL */
const BBC_LONDON_RSS = "https://www.bbc.co.uk/news/england/london/rss.xml";

/** Shape of a news headline we return to the client */
interface NewsHeadline {
  title: string;
  link: string;
  pubDate: string;
}

/**
 * Extract text content between XML tags.
 * Simple regex approach — no need for a full XML parser
 * since RSS feeds have a predictable structure.
 *
 * @param xml - The XML string to search
 * @param tag - The tag name to extract (e.g. "title")
 * @returns The text content between the opening and closing tags
 */
function extractTag(xml: string, tag: string): string {
  /*
   * Match <tag>content</tag> or <tag><![CDATA[content]]></tag>
   * The CDATA pattern is common in RSS feeds for titles with
   * special characters like & or <
   */
  const cdataMatch = xml.match(
    new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`)
  );
  if (cdataMatch) return cdataMatch[1].trim();

  const simpleMatch = xml.match(
    new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)
  );
  if (simpleMatch) return simpleMatch[1].trim();

  return "";
}

export async function GET() {
  try {
    /*
     * Fetch the BBC London RSS feed.
     * next.revalidate caches the response for 15 minutes
     * so we don't hit BBC on every page load.
     */
    const response = await fetch(BBC_LONDON_RSS, {
      next: { revalidate: 900 }, /* 15 minutes */
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch news feed" },
        { status: 502 }
      );
    }

    const xml = await response.text();

    /*
     * Split the XML into individual <item> blocks.
     * Each <item> is one news story with title, link, pubDate.
     */
    const items = xml.split("<item>");

    /* Skip the first split result — it's everything before the first <item> */
    const headlines: NewsHeadline[] = items
      .slice(1, 11) /* Take up to 10 headlines */
      .map((item) => ({
        title: extractTag(item, "title"),
        link: extractTag(item, "link"),
        pubDate: extractTag(item, "pubDate"),
      }))
      .filter((h) => h.title.length > 0); /* Skip empty titles */

    return NextResponse.json(headlines);
  } catch (error) {
    console.error("News feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
