const axios = require("axios");

const instaErrorShown = {};

async function getLatestPost(username) {
  try {
    const res = await axios.get(
      `https://www.instagram.com/${username}/?__a=1&__d=dis`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        timeout: 5000,
      },
    );

    // ❌ STRUCTURE ISSUE
    if (!res.data || !res.data.graphql || !res.data.graphql.user) {
      if (!instaErrorShown[username]) {
        console.log("⚠️ Insta structure invalid for:", username);
        instaErrorShown[username] = true;
      }
      return null;
    }

    const edges = res.data.graphql.user.edge_owner_to_timeline_media.edges;

    if (!edges || edges.length === 0) return null;

    const post = edges[0].node;

    // ✅ SUCCESS → RESET ERROR FLAG
    if (instaErrorShown[username]) {
      console.log(`✅ Instagram working again: ${username}`);
      instaErrorShown[username] = false;
    }

    return {
      id: post.id,
      caption:
        post.edge_media_to_caption?.edges?.[0]?.node?.text ||
        post.accessibility_caption ||
        "No caption",
      url: `https://instagram.com/p/${post.shortcode}`,
    };
  } catch (err) {
    if (!instaErrorShown[username]) {
      console.log("⚠️ Insta fetch failed:", err.message);
      instaErrorShown[username] = true;
    }
    return null;
  }
}

module.exports = { getLatestPost };
