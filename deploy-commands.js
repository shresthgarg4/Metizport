require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const folders = fs.readdirSync(commandsPath);

console.log("📁 Found folders:", folders);

for (const folder of folders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".js"));

  console.log(`  📂 ${folder}: ${commandFiles.length} files`);

  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${folder}/${file}`);

      if (!command.data) {
        console.log(`    ⚠️ ${file} has no data property`);
        continue;
      }

      if (Array.isArray(command.data)) {
        for (const cmd of command.data) {
          if (cmd.name) {
            commands.push(cmd.toJSON());
            console.log(`    ✅ Loaded subcommand: ${cmd.name} from ${file}`);
          }
        }
      } else {
        if (command.data.name) {
          commands.push(command.data.toJSON());
          console.log(
            `    ✅ Loaded command: ${command.data.name} from ${file}`,
          );
        }
      }
    } catch (error) {
      console.error(`    ❌ Error loading ${file}:`, error.message);
    }
  }
}

console.log(`\n📋 Total commands to deploy: ${commands.length}`);
console.log("Command names:", commands.map((c) => c.name).join(", "));

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deploy() {
  try {
    console.log(`\n🚀 Deploying ${commands.length} commands...`);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      { body: commands },
    );

    console.log("✅ Commands deployed successfully!");
    console.log(
      "Available commands:",
      commands.map((c) => `/${c.name}`).join(", "),
    );
  } catch (error) {
    console.error("❌ Deploy error:", error);
  }
}

deploy();
