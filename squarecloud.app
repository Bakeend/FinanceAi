DISPLAY_NAME=FinanceAi
MAIN=backend/dist/main.js
MEMORY=512
VERSION=recommended
BUILD=npm run setup && npm run build
START=npm --prefix backend run start:prod
