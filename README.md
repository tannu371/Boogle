
### Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

### in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"


### Download and install Node.js:
nvm install node

### Verify the Node.js version:
node -v

### Verify npm version:
npm -v

### Install nodemon globally:
npm i -g nodemon 

### Verify nodemon version:
nodemon -v


### Install all the dependencies mentioned in package.json:
npm install 


### To run the project:
npm start

### To auto-restart on changes:
npm run dev
