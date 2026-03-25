// systems/social/socialManager.js
const fs = require("fs");
const path = require("path");
const worker = require("./worker");

const CONFIG_PATH = path.join(__dirname, "../../data/pingconfig.json");

class SocialManager {
  constructor(client) {
    this.client = client;
    this.running = false;
    this.delay = 15000; // SAFE DELAY (15s)
  }

  loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_PATH));
  }

  async start() {
    this.running = true;
    console.log("✅ Social system started");

    while (this.running) {
      try {
        const config = this.loadConfig();

        if (config) {
          await worker.process(this.client, config);
        }
      } catch (e) {
        console.log("❌ Social error:", e.message);
      }

      await new Promise((r) => setTimeout(r, this.delay));
    }
  }

  stop() {
    this.running = false;
  }
}

module.exports = SocialManager;
