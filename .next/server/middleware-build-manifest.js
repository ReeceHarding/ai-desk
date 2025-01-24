self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [
    "static/chunks/react-refresh.js"
  ],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [],
  "pages": {
    "/404": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/404.js"
    ],
    "/[orgSlug]/new-ticket": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/[orgSlug]/new-ticket.js"
    ],
    "/_app": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_app.js"
    ],
    "/_error": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_error.js"
    ],
    "/auth/signin": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/auth/signin.js"
    ],
    "/auth/signup": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/auth/signup.js"
    ],
    "/dashboard": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/dashboard.js"
    ],
    "/onboarding": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/onboarding.js"
    ],
    "/profile": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/profile.js"
    ],
    "/tickets": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/tickets.js"
    ]
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];