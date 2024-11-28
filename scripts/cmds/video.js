const axios = require("axios");
const fs = require("fs-extra");
const yts = require("yt-search");
const path = require("path");

module.exports = {
  config: {
    name: "video",
    author: "Samir Œ",
    description: "Search and download video from YouTube",
    category: "video",
    usage: "video [title]",
    usePrefix: true
  },
  
  onStart: async ({ bot, chatId, args }) => {
    const searchTerm = args.join(" ");

    if (!searchTerm) {
      return bot.sendMessage(chatId, `Please provide a search query. Usage: /video [title]`);
    }

    const searchMessage = await bot.sendMessage(chatId, `🔍 Searching for video: ${searchTerm}`);

    try {
      const searchResults = await yts(searchTerm);
      if (!searchResults.videos.length) {
        return bot.sendMessage(chatId, "No video found for your query.");
      }

      const video = searchResults.videos[0];
      const videoUrl = video.url;
      const fileName = `${video.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
      const filePath = path.join(__dirname, "cache", fileName);

      if (fs.existsSync(filePath)) {
        console.log('[CACHE]', `File already downloaded. Using cached version: ${fileName}`);
        bot.sendVideo(chatId, fs.createReadStream(filePath), { caption: `${video.title}` });
      } else {
        // Replace ytdl-core with API call to api-dylux
        const apiUrl = `https://api.dylux.xyz/api/youtube?url=${encodeURIComponent(videoUrl)}`;

        try {
          const response = await axios.get(apiUrl);

          if (response.data && response.data.status === 'success') {
            const downloadUrl = response.data.result.url;  // Assuming the API returns the video download URL in `result.url`

            const videoWriteStream = fs.createWriteStream(filePath);
            const videoStream = await axios.get(downloadUrl, { responseType: 'stream' });

            videoStream.data.pipe(videoWriteStream);

            videoWriteStream.on('finish', () => {
              const stats = fs.statSync(filePath);
              if (stats.size > 100000000) { // 100MB size limit
                fs.unlinkSync(filePath);
                return bot.sendMessage(chatId, '❌ The file could not be sent because it is larger than 100MB.');
              }

              bot.sendVideo(chatId, fs.createReadStream(filePath), { caption: `${video.title}` });
            });

            videoWriteStream.on('error', (err) => {
              console.error('[ERROR]', err);
              bot.sendMessage(chatId, 'An error occurred while downloading the video.');
            });
          } else {
            bot.sendMessage(chatId, '❌ Failed to fetch the video from the API.');
          }
        } catch (apiError) {
          console.error('[API ERROR]', apiError);
          bot.sendMessage(chatId, 'An error occurred while processing the video download.');
        }
      }
    } catch (error) {
      console.error('[ERROR]', error);
      bot.sendMessage(chatId, 'An error occurred while processing the command.');
    }

    await bot.deleteMessage(chatId, searchMessage.message_id);
  }
};
