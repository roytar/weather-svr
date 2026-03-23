roy@Roys-MacBook-Pro-3 ~ % mkdir weather
roy@Roys-MacBook-Pro-3 ~ % cd weather
roy@Roys-MacBook-Pro-3 weather % npm init -y
Wrote to /Users/roy/weather/package.json:

{
  "name": "weather",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}



roy@Roys-MacBook-Pro-3 weather % npm install typescript ts-node @types/node @tsc
onfig/node24 --save-dev

added 21 packages, and audited 22 packages in 2s

found 0 vulnerabilities
roy@Roys-MacBook-Pro-3 weather % code tsconfig.json
zsh: command not found: code
roy@Roys-MacBook-Pro-3 weather % code
zsh: command not found: code
roy@Roys-MacBook-Pro-3 weather % ls
node_modules		package-lock.json	package.json
roy@Roys-MacBook-Pro-3 weather %
roy@Roys-MacBook-Pro-3 weather % npm install jest ts-jest @types/jest --save-dev

npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me

added 332 packages, and audited 354 packages in 10s

46 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities




roy@Roys-MacBook-Pro-3 weather % npm run test

> weather@1.0.0 test
> jest

 PASS  tests/add.tests.ts
  ✓ should add two numbers correctly (1 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.453 s, estimated 1 s
Ran all test suites.
roy@Roys-MacBook-Pro-3 weather % npm init @eslint/config@latest
Need to install the following packages:
@eslint/create-config@1.11.0
Ok to proceed? (y)


> weather@1.0.0 npx
> create-config

@eslint/create-config: v1.11.0

✔ What do you want to lint? · javascript
✔ How would you like to use ESLint? · problems
✔ What type of modules does your project use? · esm
✔ Which framework does your project use? · none
✔ Does your project use TypeScript? · No / Yes
✔ Where does your code run? · browser
✔ Which language do you want your configuration file be written in? · js
ℹ The config that you've selected requires the following dependencies:

eslint, @eslint/js, globals, typescript-eslint
✔ Would you like to install them now? · No / Yes
✔ Successfully created /Users/roy/weather/eslint.config.mjs file.
⚠ You will need to install the dependencies yourself.
roy@Roys-MacBook-Pro-3 weather % npm init @eslint/config@latest

> weather@1.0.0 npx
> create-config

@eslint/create-config: v1.11.0

✔ What do you want to lint? · javascript
✔ How would you like to use ESLint? · problems
✔ What type of modules does your project use? · esm
✔ Which framework does your project use? · none
✔ Does your project use TypeScript? · No / Yes
✔ Where does your code run? · No items were selected
✔ Which language do you want your configuration file be written in? · js
ℹ The config that you've selected requires the following dependencies:

eslint, @eslint/js, typescript-eslint
✔ Would you like to install them now? · No / Yes
✔ Which package manager do you want to use? · npm
☕️Installing...

added 76 packages, and audited 430 packages in 5s

73 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
✔ Successfully created /Users/roy/weather/eslint.config.mjs file.
roy@Roys-MacBook-Pro-3 weather % npm install eslint-plugin-jest --save-dev

added 1 package, and audited 431 packages in 1s

73 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
roy@Roys-MacBook-Pro-3 weather % npm install --save-dev eslint-plugin-prettier e
slint-config-prettier

added 5 packages, and audited 436 packages in 1s

76 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
roy@Roys-MacBook-Pro-3 weather % npm insta;; --save-dev --save-exact prettier
zsh: parse error near `;;'
roy@Roys-MacBook-Pro-3 weather % npm install --save-dev --save-exact prettier

up to date, audited 436 packages in 559ms

76 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
roy@Roys-MacBook-Pro-3 weather % npm run lint

> weather@1.0.0 lint
> eslint


Oops! Something went wrong! :(

ESLint: 10.0.3

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'globals' imported from /Users/roy/weather/eslint.config.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:255:9)
    at packageResolve (node:internal/modules/esm/resolve:767:81)
    at moduleResolve (node:internal/modules/esm/resolve:853:18)
    at defaultResolve (node:internal/modules/esm/resolve:983:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:801:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:725:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:708:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:309:38)
    at #link (node:internal/modules/esm/module_job:201:49)


npm install --save-dev globals

roy@Roys-MacBook-Pro-3 weather % npm run lint

> weather@1.0.0 lint
> eslint


/Users/roy/weather/eslint.config.mjs
  36:3  error  Insert `⏎`  prettier/prettier

/Users/roy/weather/jest.config.js
   2:3  error  Replace `··"preset"` with `preset`                                                                                                                                                                          prettier/prettier
   3:3  error  Replace `···"testEnvironment"` with `testEnvironment`                                                                                                                                                       prettier/prettier
   4:3  error  Replace `··"roots"` with `roots`                                                                                                                                                                            prettier/prettier
   5:3  error  Replace `··"transform"` with `transform`                                                                                                                                                                    prettier/prettier
   6:1  error  Replace `········` with `····`                                                                                                                                                                              prettier/prettier
   7:1  error  Delete `··`                                                                                                                                                                                                 prettier/prettier
   8:3  error  Replace `···"testRegex"` with `testRegex`                                                                                                                                                                   prettier/prettier
   9:1  error  Delete `····`                                                                                                                                                                                               prettier/prettier
  10:3  error  Replace `··"moduleFileExtensions":·[⏎········"ts",⏎········"tsx",⏎········"js",⏎········"jsx",⏎········"json",⏎········"node"⏎····` with `moduleFileExtensions:·["ts",·"tsx",·"js",·"jsx",·"json",·"node"`  prettier/prettier
  18:2  error  Insert `;⏎`                                                                                                                                                                                                 prettier/prettier

/Users/roy/weather/src/utils.ts
  18:2  error  Insert `⏎`  prettier/prettier

/Users/roy/weather/tests/add.tests.ts
  1:9  error  Replace `add}·from·'../src/utils'` with `·add·}·from·"../src/utils"`                       prettier/prettier
  2:3  error  Replace `·('should·add·two·numbers·correctly'` with `("should·add·two·numbers·correctly"`  prettier/prettier
  6:4  error  Insert `⏎`                                                                                 prettier/prettier

✖ 15 problems (15 errors, 0 warnings)
  15 errors and 0 warnings potentially fixable with the `--fix` option.

roy@Roys-MacBook-Pro-3 weather %
roy@Roys-MacBook-Pro-3 weather %

roy@Roys-MacBook-Pro-3 weather % npm run lint -- --fix

> weather@1.0.0 lint
> eslint --fix

roy@Roys-MacBook-Pro-3 weather % npm run lint

> weather@1.0.0 lint
> eslint


/Users/roy/weather/src/utils.ts
  3:7  error  'c' is never reassigned. Use 'const' instead  prefer-const

✖ 1 problem (1 error, 0 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.

roy@Roys-MacBook-Pro-3 weather % npm install nodemon dotenv-cli --save-dev

