const axios = require("axios");

const instaErrorShown = {};

async function getLatestPost(username) {
  try {
    const res = await axios.get(
      `https://www.instagram.com/${username}/?__a=1&__d=dis`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 5000,
      },
    );

    const user = res.data?.graphql?.user;

    if (!user) {
      if (!instaErrorShown[username]) {
        console.log("⚠️ Insta structure invalid for:", username);
        instaErrorShown[username] = true;
      }
      return null;
    }

    const post = user.edge_owner_to_timeline_media.edges[0].node;

    if (instaErrorShown[username]) {
      console.log(`✅ Instagram working again: ${username}`);
      instaErrorShown[username] = false;
    }

    return {
      id: post.id,
      caption:
        post.edge_media_to_caption?.edges?.[0]?.node?.text || "No caption",
      url: `https://instagram.com/p/${post.shortcode}`,
      image: post.display_url,
      likes: post.edge_liked_by.count,
      comments: post.edge_media_to_comment.count,
      profile: user.profile_pic_url_hd,
      username: user.username,
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
