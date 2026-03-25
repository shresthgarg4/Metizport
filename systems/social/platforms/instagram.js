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

    const post =
      res.data.graphql.user.edge_owner_to_timeline_media.edges[0]?.node;

    if (!post) return null;

    return {
      id: post.id,
      caption: post.edge_media_to_caption.edges[0]?.node?.text || "No caption",
      image: post.display_url,
      url: `https://instagram.com/p/${post.shortcode}`,
    };
  } catch (err) {
    console.log("⚠️ Insta fetch failed:", err.message);
    return null;
  }
}

module.exports = { getLatestPost };
