overclockers
============

What
----

overclockers.ru results db scraper, RESTful server and alternative ui.

Why
---

[overclockers.ru](http://overclockers.ru) is an old pc hardware news site which also has a user-committed database of cpu overclocking results (~26k results). It is quite helpful if you are trying to speed up your old pc a bit or are choosing a new cpu to buy. Unfortunately, the site has been in decline for the last couple of years and its main page is so full of ads even adblock cannot cut them all. It is also quite slow and ugly. This package lets you: take all the results from overclockers db, launch a RESTful server to serve these results, serve the results through a simple(r) and fast(er) ui.

How
---

To use this package:

1. Clone it `git clone https://github.com/yeriomin/overclockers`
2. Install the dependencies `npm install`
3. Scrape the results from overclockers.ru. It takes ~5 minutes `node scrape.js`
4. Launch the REST wrapper around the db `node server.js`
5. Serve `index.html` to the user using any static http you like or simply open it in a browser from your fs `firefox index.html`
