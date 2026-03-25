// systems/social/platforms/instagram.js

const axios = require("axios");

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

    // 🛑 SAFE CHECK
    if (!res.data || !res.data.graphql || !res.data.graphql.user) {
      console.log("⚠️ Insta structure invalid for:", username);
      return null;
    }

    const edges = res.data.graphql.user.edge_owner_to_timeline_media.edges;

    if (!edges || edges.length === 0) return null;

    const post = edges[0].node;

    return {
      id: post.id,
      caption:
        post.edge_media_to_caption?.edges?.[0]?.node?.text ||
        post.accessibility_caption ||
        "No caption",
      url: `https://instagram.com/p/${post.shortcode}`,
    };
  } catch (err) {
    console.log("⚠️ Insta fetch failed:", err.message);
    return null;
  }
}

module.exports = { getLatestPost };
