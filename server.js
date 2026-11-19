const express = require("express");
const dns = require("dns").promises;
const net = require("net");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

let pdfParse = null;
let mammoth = null;

try {
    pdfParse = require("pdf-parse");
} catch {}

try {
    mammoth = require("mammoth");
} catch {}

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_RESPONSE_BYTES = 15 * 1024 * 1024;
const VERSION = "Schoolio Proxy 5.9";

// Raw request bodies are preserved for proxied POST/PUT/PATCH requests.
app.use("/proxy", express.raw({
    type: () => true,
    limit: MAX_RESPONSE_BYTES
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Range, If-None-Match, If-Modified-Since"
    );
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

const DEFAULT_ALLOWED_HOSTS = [
    "petezahgames.com",
    "petezahgames.github.io",
    "roblox.com",
    "rbxcdn.com",
    "github.com",
    "api.github.com",
    "docs.github.com",
    "githubusercontent.com",
    "raw.githubusercontent.com",
    "stackoverflow.com",
    "stackexchange.com",
    "codepen.io",
    "jsfiddle.net",
    "replit.com",
    "npmjs.com",
    "nodejs.org",
    "python.org",
    "pypi.org",
    "developer.mozilla.org",
    "mozilla.org",
    "w3.org",
    "w3schools.com",
    "cloudflare.com",
    "cdnjs.cloudflare.com",
    "jsdelivr.net",
    "unpkg.com",
    "bootstrapcdn.com",
    "fontawesome.com",
    "wikipedia.org",
    "wikimedia.org",
    "wiktionary.org",
    "britannica.com",
    "merriam-webster.com",
    "dictionary.com",
    "thesaurus.com",
    "archive.org",
    "gutenberg.org",
    "khanacademy.org",
    "quizlet.com",
    "desmos.com",
    "geogebra.org",
    "wolframalpha.com",
    "quizizz.com",
    "wayground.com",
    "huggingface.co",
    "hf.co",
    "duck.ai",
    "duckduckgo.com",
    "microsoft.com",
    "learn.microsoft.com",
    "support.microsoft.com",
    "office.com",
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "googleusercontent.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "scholar.google.com",
    "books.google.com",
    "translate.google.com",
    "render.com",
    "vercel.com",
    "netlify.com",
    "railway.app",
    "nasa.gov",
    "noaa.gov",
    "usgs.gov",
    "nih.gov",
    "cdc.gov",
    "who.int",
    "weather.gov",
    "census.gov",
    "data.gov",
    "loc.gov",
    "sec.gov",
    "irs.gov",
    "federalreserve.gov",
    "stlouisfed.org",
    "bea.gov",
    "bls.gov",
    "finra.org",
    "investopedia.com",
    "nasdaq.com",
    "nyse.com",
    "yahoo.com",
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "npr.org",
    "imdb.com",
    "rottentomatoes.com",
    "goodreads.com",
    "medium.com",
    "substack.com",
    "canva.com",
    "figma.com",
    "notion.so",
    "1001games.com",
    "1games.io",
    "addictinggames.com",
    "agame.com",
    "armor.com",
    "azgames.io",
    "battle.net",
    "bbogd.net",
    "blizzard.com",
    "boardgamearena.com",
    "browsergames.gg",
    "camadia.com",
    "connectionsgame.org",
    "construct.net",
    "coolmathgames.com",
    "crazygames.com",
    "discord.com",
    "ea.com",
    "epicgames.com",
    "freecivweb.org",
    "galatium.net",
    "gamemonetize.com",
    "geometry-lite.io",
    "gog.com",
    "immoralattack.com",
    "immortalday.com",
    "itch.io",
    "kongregate.com",
    "landofnevard.net",
    "mademanmafia.com",
    "mafiareturns.com",
    "miniclip.com",
    "mobsters-united.com",
    "mpogr.com",
    "newgrounds.com",
    "newyork-mafia.com",
    "nintendo.com",
    "piratequest.org",
    "playstation.com",
    "playsuikagame.com",
    "pokerogue.io",
    "poki.com",
    "puzzlist.com",
    "riotgames.com",
    "simdynasty.com",
    "slithergame.io",
    "slopeonline.online",
    "speedrun.com",
    "steampowered.com",
    "suikagame.com",
    "suikagame.io",
    "top100webgames.com",
    "topwebgames.com",
    "twitch.tv",
    "twoplayergames.org",
    "ubisoft.com",
    "unity.com",
    "wafflegame.net",
    "wordle2.io",
    "xbox.com",
    "y8.com",
    "solara.sendreward.com",
    "solara.inakazu.ca",
    "triplet.sendreward.com",
    "triplet.inakazu.ca",
    "pler.sendreward.com",
    "pler.inakazu.ca",
    "voya.sendreward.com",
    "voya.inakazu.ca",
    "stroberri.sendreward.com",
    "stroberri.inakazu.ca",
    "tung.sendreward.com",
    "tungt.inakazu.ca",
    "studyhub.sendreward.com",
    "studyhub.inakazu.ca",
    "utopia.sendreward.com",
    "lunar.sendreward.com",
    "lunar.inakazu.ca",
    "aurora.sendreward.com",
    "aurora.inakazu.ca",
    "space.sendreward.com",
    "space.inakazu.ca",
    "cinera.sendreward.com",
    "cinera.inakazu.ca",
    "locker.c00lcars.media",
    "locker.c00lkiddtech.live",
    "locker.lucario.site",
    "locker.six-seven.best",
    "locker.skidside.xyz",
    "locker.ssquatch.lol",
    "locker.studypath.academy",
    "cdn.jsdelivr.net",
    "fastly.jsdelivr.net",
    "gcore.jsdelivr.net",
    "raw.githack.com",
    "rawcdn.githack.com",
    "obtede179.calc247.io",
    "lira179.b-cdn.net",
    "joachoa179.s3.amazonaws.com",
    "joawa179.storage.googleapis.com",
    "jiala1.techforedu.technology",
    "jiala1.learnfaster.support",
    "jiala1.futureskills.mom",
    "jiala1.thinkbiglearn.college",
    "jiala1.learnwith.cwourses",
    "jiala1.getfree.email",
    "jiala1.smartlearning.solutions",
    "jiala1.learntoinvest.trade",
    "jiala1.learnworks.enterprises",
    "jiala1.dailylearn.onl",
    "jiala1.learningplatform.reviews",
    "jiala1.studyguide.wiki",
    "jiala1.neverstop.study",
    "jiala1.learneveryday.school",
    "algebra.geometry.pagofsp.com",
    "edu.worldplus-intl.org",
    "quantumflow189.calc247.io",
    "litya189.b-cdn.net",
    "tiual189.s3.amazonaws.com",
    "liauy189.storage.googleapis.com",
    "jiala1.learnwith.courses",
    "ralsei-nth1.s3.amazonaws.com",
    "axk4.s3.amazonaws.com",
    "kitebrowser.b-cdn.net",
    "notebinderapp.s3.amazonaws.com",
    "h7ww.s3.amazonaws.com",
    "jkss.s3.amazonaws.com",
    "s3ef.s3.amazonaws.com",
    "utopia.schovat.net",
    "utopia.schneiderhome.us",
    "wcfg.s3.amazonaws.com",
    "wise.offgamers.com.my",
    "esm.sh",
    "quantil.jsdelivr.net",
    "originfastly.jsdelivr.net",
    "testingcf.jsdelivr.net",
    "cdn.jsdelivr.us",
    "jsdelivr.b-cdn.net",
    "jsdelivr.codeqihan.com",
    "jsd.proxy.aks.moe",
    "cdn.jsdmirror.com",
    "cdn.jsdmirror.cn",
    "jsd.cdn.zzko.cn",
    "jsd.onmicrosoft.cn",
    "cdn.onmicrosoft.cn",
    "jsd.nmmsl.top",
    "jsd.duolaa.top",
    "cdn.bili33.top",
    "jsdelivr.qaq.qa",
    "jsdelivr.aby.pub",
    "jsdelivr.topthink.com",
    "jsd.yizex.cn",
    "code.webcache.cn",
    "cdn.esm.sh",
    "raw.esm.sh",
    "cdn.statically.io",
    "cdn.staticdelivr.com",
    "cdn.jsdelivr.net.cn",
    "jsdelivr.cdn.net",
    "jsd-proxy.ygxz.in",
    "bit.ly",
    "calculus.trigonometry.chicagosbestbar.com",
    "arithmetic.statistics.tickevict.org",
    "equation.formula.johngallo.net",
    "variable.integer.virtunder.org",
    "decimal.fraction.thalamx.com",
    "percentage.polynomial.get18percent.com",
    "function.graph.tickevict.org",
    "exponent.coefficient.mattflack.com",
    "theorem.proof.daphnechanconsulting.org",
    "vector.matrix.burriss.org",
    "measurement.conversion.abundanceresearchinstitute.com",
    "addition.subtraction.eltallerdelaratita.com",
    "algorithm.calculation.chicagosbestbar.com",
    "multiplication.division.jinaladin.com",
    "testingcdn.jsdelivr.net",
    "rawcdn.jsdelivr.net",
    "math-docs-v4.thejeephellorip.workers.dev",
    "lightspeedstudyingtipsfortests.5sn5c6n8wd.workers.dev",
    "pure-lobster-97.specmandi-arch.deno.net",
    "nikehub-math1.b-cdn.net",
    "slow-lamb-71.specmandi.deno.net",
    "doctorge-laoshi.global.ssl.fastly.net",
    "ap-class-studies-572041995.b-cdn.net",
    "betweencluodydaysthelifeislived.thestream.deno.net",
    "learningaboutfrogs-easy.b-cdn.net",
    "physical-science-essay-draft.notdudeperfect85.workers.dev",
    "securly.sylisludwig3.workers.dev",
    "mathtutor-lecture-edu.jesusisking19734.workers.dev",
    "6th-grade-bio-class-and-math-with-a-10-piece-mcchicken-that-wil.sylisludwig3.workers.dev",
    "biology-lab-notes-2026chem-equations.stem-education.workers.dev",
    "workingwith-gannon-because-ryker-haughton-is-super-gay-edu.b-cdn.net",
    "howtosolveforx.asawasa12341.deno.net",
    "puresite7978.b-cdn.net",
    "litecore6232.b-cdn.net",
    "megazone5830.b-cdn.net",
    "supersite5947.b-cdn.net",
    "apexcore3257.b-cdn.net",
    "superweb1655.b-cdn.net",
    "clearsite5954.b-cdn.net",
    "megaedge6276.b-cdn.net",
    "ultrahub9986.b-cdn.net",
    "boldweb6153.b-cdn.net",
    "brightdash9189.b-cdn.net",
    "freshhub5988.b-cdn.net",
    "pureflux1602.b-cdn.net",
    "rapidcore8474.b-cdn.net",
    "smartcdn3310.b-cdn.net",
    "ultrapipe8488.b-cdn.net",
    "fastcore6310.b-cdn.net",
    "apexpath2911.b-cdn.net",
    "learning.colloky.com.pe",
    "strawberryapp.b-cdn.net",
    "repeating.xylora.webinfo.tw",
    "xylora.read.about.willy.cat",
    "xylora.research.about.dogs.valor.ar",
    "xy.lora.grahammurryinsuranceagency.com",
    "days.delia-derbyshire.net",
    "resting.cazaresulina.ro",
    "fishes.colloky.com.pe",
    "testing.notariamelipilla.cl",
    "exam.grahammurryinsuranceagency.com",
    "xylora.math.science.heidibranlund.com",
    "xylora.rust.rusticrivergear.com",
    "xylora.testout.repuestoslibertad.cl",
    "xylora.countertops.kwgranitecountertops.com",
    "xylora.searching.dirtchicvt.com",
    "dontlust.wikidelia.net",
    "historyislife.wikidelia.net",
    "ineedtolarpnow.wikidelia.net",
    "scienceiskey.wikidelia.net",
    "thestudyhelps.wikidelia.net",
    "trade.my.biblosconsulting.ru",
    "totallynotsuspicious.at.all.biblosconsulting.ru",
    "manhattan.mathematical.scientific.foundation.university.biblosconsulting.ru",
    "studyingtipsforyou.s3.us-east-2.amazonaws.com",
    "peep.sandi.web.id",
    "baconismath.mojadelavnica.si",
    "happybacon.mojadelavnica.si",
    "masterlearning.mojadelavnica.si",
    "mathmath.mojadelavnica.si",
    "monsterreading.mojadelavnica.si",
    "library.computer.chemistry.biology.calculus.stressmap.ru",
    "overcloaked-v2.b-cdn.net",
    "chemistry.reading.math.writing.teacher.pnlbraila.ro",
    "geometry.programming.technology.english.student.pjsfeed.com",
    "lecture.history.biology.science.writing.arxeiokin.gr",
    "whossunil7.sunil7.com.np",
    "spokeissuchaweirdo.biriyomz.com",
    "alex.alexkrav.se",
    "alexx.alexkrav.se",
    "karv.se.alexkrav.se",
    "krav.alexkrav.se",
    "se.alexkrav.se",
    "vek.polden21vek.ru",
    "polden.polden21vek.ru",
    "21vek.polden21vek.ru",
    "student.physics.music.vocabulary.science.perrosargentina.com",
    "lecture.literature.programming.campus.student.mik.id.lv",
    "english.biology.history.classroom.seminar.pec.com.ar",
    "geography.student.calculus.reading.homework.zanottofamilywines.com",
    "classroom.calculus.math.studying.library.evaandering.com",
    "science.vocabulary.physics.engineering.campus.longyee-fareast.com",
    "campus.technology.assignment.english.project.biobotsprinters.com",
    "programming.computer.writing.homework.calculus.virtualmunch.com",
    "geography.biology.student.classroom.programming.perrosargentina.com",
    "homework.grammar.assignment.english.studying.mik.id.lv",
    "writing.classroom.programming.drama.assignment.zanottofamilywines.com",
    "reading.lecture.drama.english.learning.pec.com.ar",
    "studying.music.project.homework.algebra.longyee-fareast.com",
    "studying.project.writing.geography.learning.biobotsprinters.com",
    "homework.geography.campus.chemistry.teacher.evaandering.com",
    "homework.grammar.lecture.math.geography.perrosargentina.com",
    "learning.project.programming.calculus.drama.virtualmunch.com",
    "math.art.literature.studying.music.mik.id.lv",
    "studying.calculus.assignment.grammar.music.pec.com.ar",
    "project.science.art.physics.technology.pec.com.ar",
    "reading.megaingenieria.com",
    "inquiry.vomytdaug.com",
    "doctor.lovethosetrains.com",
    "study.buaa.mx",
    "learning.geoffreid.ca",
    "safe.hesgoaler.com",
    "social.inmobiliariamardelplata.com",
    "safe.laprensaenlinea.com.mx",
    "development.robertschulze.org",
    "academics.yes.web.id",
    "xylora.geoffreid.ca",
    "community.expedicionesytrekking.com",
    "searching.localghost.org",
    "experiment.daniel-drubin.com",
    "member.parquecidades-eim.pt",
    "online.richsfamilyonline.net",
    "day.keshabkafle.com.np",
    "day.goaphrodite.co.uk",
    "day.triatlonpacense.es",
    "day.notinthearchives.net",
    "day.jeffpliska.us",
    "health.centrodiagnosticogenetico.com",
    "sports.oldsouthmarlinclub.com",
    "business.rainbowcreative.web.id",
    "education.gauravn.com.np",
    "bubbles.baublebabes.com",
    "crafting.craftyme.ro",
    "cheese.enjoywalensee.ch",
    "government.hazelgrovepac.ca",
    "xylora-on.top.mexicommerce.com.mx",
    "xylora-is.goated.pratikpatel.in",
    "xylora-is-the.best.seriousdispute.com",
    "xylora-is.larping.horan.id.au",
    "horaniu.horan.id.au",
    "mathematicsformula.b-cdn.net",
    "htmlcodeclass.b-cdn.net",
    "napleap11.becasuniversitarias.org",
    "felinecatclass81.bridgeportmath.org",
    "napkit19.fukushimastudy.org",
    "scratchcat33.becasuniversitarias.org",
    "catcatnip84.bridgeportmath.org",
    "mewleap69.fukushimastudy.org",
    "leapcatnip14.becasuniversitarias.org",
    "catnipmew99.bridgeportmath.org",
    "scruffwhisker72.fukushimastudy.org",
    "kittyfluff50.becasuniversitarias.org",
    "catfur92.bridgeportmath.org",
    "keep.confiarriendo.cl",
    "science.dj8.org",
    "enter.agrointegral.cl",
    "search.loveyourselfbeauty.au",
    "location.ronginbari.com",
    "enter.srivaishnavam.org.au",
    "marksenergy.maxmir-energy.ru",
    "api.iaconetti.com.ar",
    "looking.loskks.org",
    "secured.remiosenifoundation.org",
    "chanka-stores.chanka.com",
    "social.50friends.com.mx",
    "apis.extratechsolutions.com",
    "seize.mounthoodlodges.com",
    "s.api.rabsacca.com",
    "modern.moldeointeractive.com.ar",
    "anyalizing.newtonanalytics.com",
    "elephant.elprado.com.ar",
    "gecko.geckobungalow.com",
    "orchid.orchid-idea.com",
    "gecko.lauriemillotte.com",
    "vitrual-ideas.tippyturtle.com",
    "leach.contraprivatizacao.com.br",
    "junior.7dejunio.com.ar",
    "bible.biblosconsulting.ru",
    "believe.bijayakilla.com",
    "hand-working.handfolding.com",
    "watch.lavachamber.com",
    "aven.avenuecarriagecrossing.com",
    "igu.govt.hu",
    "dot.mjureta.cl",
    "short.shor.ch",
    "fried.silvaharo.com",
    "software.bsfa.info",
    "software.cnstefancelmare.ro",
    "gurdit.gurdit.com",
    "software.sundby.com",
    "where-da-hoes-at.medicalscience.academy",
    "appleseedchan-is-a-girl-trust.medicalscience.academy",
    "mommy.medicalscience.academy",
    "aetherontop.medicalscience.academy",
    "bob.medicalscience.academy",
    "cheese.medicalscience.academy",
    "sunburn.medicalscience.academy",
    "edu.medicalscience.academy",
    "sonion.medicalscience.academy",
    "summerbreak.medicalscience.academy",
    "a2174-99533489.cluster40.canvas-user-content.com",
    "quizizz-static.s3.amazonaws.com",
    "quizizz-static.s3-accelerate.amazonaws.com",
    "cosmic-ubg-v-1--drunkenkermit.replit.app",
    "nonoski.web.app",
    "xcloud2.b-cdn.net",
    "loremgroup.org",
    "www.loremgroup.org",
    "xcloud.loremgroup.org",
    "media.quizizz.com",
    "vps-62802f97.vps.ovh.us",
    "link.portek.net.au",
    "api.waterloomath.com",
    "loremgroup.onlidigital.com",
    "donttouch.my-ns.com",
    "earth.bentnailfarm4121.com",
    "ilovemath.online",
    "www.ilovemath.online",
    "inknetworks.site",
    "www.inknetworks.site",
    "acting.art-motel.com",
    "historical.eminescusm.ro",
    "action-us.b-cdn.net",
    "mapp-reworked.b-cdn.net",
    "albert.virtualmunch.com",
    "great.virtualmunch.com",
    "math.virtualmunch.com",
    "catnipclaw95.becasuniversitarias.org",
    "mewcat23.becasuniversitarias.org",
    "fluffhiss12.becasuniversitarias.org",
    "kitcatnip36.bridgeportmath.org",
    "whiskermew73.bridgeportmath.org",
    "aspen-storage.cc.cd",
    "bestspark.dynamic-dns.info",
    "bestspark.dynamisches-dns.de",
    "diddylarpfoidnetwork.gamalabs.net",
    "studenteducationfund.org.gamalabs.net",
    "xylora.studenteducationfund.org",
    "bunny.net.unionvillelacrosse.com",
    "riversidechurch.b.cnd.unionvillelacrosse.com",
    "math.b.cnd.unionvillelacrosse.com",
    "ixllearn.b.cnd.unionvillelacrosse.com",
    "ixl.con.b.cnd.unionvillelacrosse.com",
    "geniusmathgames.b-cdn.net",
    "geicos.alalalal.com",
    "heaven.angel.place",
    "lunarphysics.jz-katagis.eu",
    "ionic.nettelcorp.com",
    "healthy.truefruit.tw",
    "friends.lavachamber.com",
    "upinlife.opaline.cl",
    "plugging.plugs.it",
    "headpain.savenewport.com",
    "lunaarphysics.seriousdispute.com",
    "responsiveeducation.org",
    "eagerlessons.caheobay.com",
    "rapidmath.fpva.ru",
    "broadreading.caheobay.com",
    "guidedgeometry.fpva.ru",
    "activestudy.caheobay.com",
    "outsourcers4.biz",
    "bigideamath.kavellewatches.com",
    "tungtung.asturkiters.es",
    "tungtung.aldeadesigns.com",
    "upinlife.mikeyin.org",
    "lightspeed.fpva.ru",
    "goguardianvcsa.majatanzt.ch",
    "playernation.nurah.com.my",
    "cipher.rodzinnawiez.pl",
    "contentkeper.silentcomponents.com",
    "tungtungisfire.jz-katagis.eu",
    "tooeasy.b-cdn.net",
    "divine-tooth-bb8c.deledao.workers.dev",
    "korona.virus.bdyoutube.com",
    "korona.2020.core.bdyoutube.com",
    "universium--penguimyz.replit.app",
    "beenspitting.asturkiters.es",
    "bigmanjat.asturkiters.es",
    "caseoh.caheobay.com",
    "reader-learning.caheobay.com",
    "wehearmath.fpva.ru",
    "ifyouloveadventureyourinluck.b-cdn.net",
    "count.coute.au",
    "autodesk.b-cdn.net",
    "edulastic-poland.b-cdn.net",
    "edulastic-spain.b-cdn.net",
    "lifeisfeelinglikeabuncha.b-cdn.net",
    "iam.that.ninja",
    "asdfghjkl.unionvillelacrosse.com",
    "2asdfghjkl.unionvillelacrosse.com",
    "3asdfghjkl.unionvillelacrosse.com",
    "4asdfghjkl.unionvillelacrosse.com",
    "5asdfghjkl.unionvillelacrosse.com",
    "mhi.banglam.com",
    "mhi.imaginelearningmath.com",
    "xtwox.strangled.net",
    "4l3x19the562oh.twilightparadox.com",
    "come.birdriver.org",
    "write.fluxus.org",
    "sargent.largent.org",
    "hungarian.oil.molgas.org",
    "oilfrom.molgas.org",
    "plan.yourtrip.shareroute.org",
    "ghostnation.radio.ghostnation.org",
    "radio.ghostnation.org",
    "carbon.fuel.combustion.molgas.org",
    "natural.gas.molgas.org",
    "oil.refined.molgas.org",
    "about.billcowher.cowher.org",
    "football.legends.billcowher.cowher.org",
    "learn.about.billcowher.cowher.org",
    "audio.repitch.repich.org",
    "voice.pitch.repich.org",
    "foodville.burger.frankenbergerfilm.org",
    "ultimate.sandwich.frankenbergerfilm.org",
    "about.jon.golf.jonmills.org",
    "golf.hall-of-fame.jonmills.org",
    "us.open.records.jonmills.org",
    "selenite-6668.logans.projectbyod.com",
    "selenite-5383.basalt.site",
    "selenite-4796.derpy.click",
    "selenite-2024.logan.learningatschool.website",
    "selenite-2622.logan.read.beer",
    "selenite-4990.logan.read.boats",
    "selenite-1558.lllogan.website",
    "selenite-1155.a2zrealty.biz",
    "selenite-3449.logan.dumb.today",
    "selenite-9823.logans.projectbyod.com",
    "selenite-8565.basalt.site",
    "selenite-1827.logan.learningatschool.website",
    "selenite-3651.logan.dumb.today",
    "vtx.227only.cyou",
    "evicwy.2hxxw7.cfd",
    "chat.123movieshd.cyou",
    "hubba.123moviesgo.cyou",
    "pluh.4rjfvjk21x.cfd",
    "happy.999hourly.cfd",
    "products.fluxus.org",
    "t1.d-n-s.org.uk",
    "t2.d-n-s.org.uk",
    "math.clienturl.net",
    "auth.gifga.com",
    "magnetic.slime.genovia.ro",
    "i.am.kira-light.yagami.genovia.ro",
    "coinjars.1234.granular.com.au",
    "fishdom.1234.granular.com.au",
    "bean-is-cool.buc.bg.geek.nz",
    "abupgykr.lightspeedsystems.help",
    "16johnossroad.bg.geek.nz",
    "azumlvis.lightspeedsystems.help",
    "beta.wwwcom.com.lightspeedsystems.help",
    "beta-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "aoejvwxh.lightspeedsystems.help",
    "bnu.bg.geek.nz",
    "beanbear20100.berubnet.com",
    "admin.asdfghjklertyuiotgv",
    "aphszcjg.lightspeedsystems.help",
    "bean-is-cool.abupgykr.lightspeedsystems.help",
    "akwesdrq.lightspeedsystems.help",
    "amxqrcgd.lightspeedsystems.help",
    "artisticsurvival.comm.mxcom.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-143.lightspeedsystems.help",
    "bean-is-cool.devcom.com.lightspeedsystems.help",
    "bjzndtci.lightspeedsystems.help",
    "admin.za.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-477.lightspeedsystems.help",
    "15.204.209.18.ip.addr.tools",
    "baygzptn.lightspeedsystems.help",
    "bezxogti.lightspeedsystems.help",
    "aretvxgu.lightspeedsystems.help",
    "bskdngvq.lightspeedsystems.help",
    "backend.com.lightspeedsystems.help",
    "aeyzicnx.lightspeedsystems.help",
    "bjriteko.lightspeedsystems.help",
    "5hyr-faq.picklesecurity.xyz",
    "5hyrs3.picklesecurity.xyz",
    "ajqdkmtc.lightspeedsystems.help",
    "i-ready.com.bg.geek.nz",
    "blogs.wwwb5hyr.picklesecurity.xyz",
    "assets-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "backend.wwwcom.com.lightspeedsystems.help",
    "app.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "anbvtpqbfc.anich",
    "172.lightspeedsystems.help",
    "afspyokj.lightspeedsystems.help",
    "bcv.bg.geek.nz",
    "bean-is-cool.comloadsshreelipi.comdsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "ayjtqxec.lightspeedsystems.help",
    "5hyr-wp.picklesecurity.xyz",
    "bpdrozaupt.pixelfucker.org",
    "brainysec.lightspeedsystems.help",
    "app.orlypedia.comcominaonline.websitecom.lightspeedsystems.help",
    "bgocio-sounds.comems.com.lightspeedsystems.help",
    "bean-is-cool.caokfvlx.lightspeedsystems.help",
    "access.picklesecurity.xyz",
    "altbee.engg.commcom.to.com.lightspeedsystems.help",
    "bjwykunp.bg.geek.nz",
    "beanbear23100.pandatune.com",
    "bean-is-cool.comdb.netectom.lightspeedsystems.help",
    "bossem.befoital.co.nzlplightspeedsystems.com.lightspeedsystems.help",
    "anxrotjf.lightspeedsystems.help",
    "akqolztv.bg.geek.nz",
    "asfqzuto.lightspeedsystems.help",
    "eg.comlplightspeedsystems.com.lightspeedsystems.help",
    "avylgfut.bg.geek.nz",
    "auehdbzm.lightspeedsystems.help",
    "003eu003ewwwu003ecomrs.comedsystems.lightspeedsystems.help",
    "5hyr2022.picklesecurity.xyz",
    "baodxjht.lightspeedsystems.help",
    "bean-is-cool.conseils",
    "admin-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "169.lightspeedsystems.help",
    "aigqhmmtnq.mfc",
    "bopzykqf.lightspeedsystems.help",
    "bdwvxrqp.lightspeedsystems.help",
    "api.wwwcom.com.lightspeedsystems.help",
    "5hyrpayment.picklesecurity.xyz",
    "admin.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "ayjungbd.lightspeedsystems.help",
    "ahgblztn.lightspeedsystems.help",
    "arsd.siteedarcom.it48.zendesk.com.com.lightspeedsystems.help",
    "asgczblh.lightspeedsystems.help",
    "api.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-170.lightspeedsystems.help",
    "bpnhrgyq.lightspeedsystems.help",
    "adboe.com.bg.geek.nz",
    "5hyrstage.picklesecurity.xyz",
    "admin.drexelbank.commystems.com.lightspeedsystems.help",
    "bean-is-cool.bpnhrgyq.lightspeedsystems.help",
    "auzfgdlt.lightspeedsystems.help",
    "bean-is-cool.cnhovdazdxwww.watermellon.bg.geek.nz",
    "aoekfqlc.lightspeedsystems.help",
    "bfywrzuc.bg.geek.nz",
    "arwjbmhx.bg.geek.nz",
    "axhrzqky.lightspeedsystems.help",
    "ayibqtzr.lightspeedsystems.help",
    "bean-is-cool.altbee.engg.commcom.to.com.lightspeedsystems.help",
    "app.naturecapture.topev.comightspeedsystems.com.lightspeedsystems.help",
    "amvzsuxj.lightspeedsystems.help",
    "admin.mobiolink.comksdf.bg.geek.nz",
    "acjbrldz.bg.geek.nz",
    "you-fucking-nigger-kill-yourself-175.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-173.lightspeedsystems.help",
    "bdlxqrek.lightspeedsystems.help",
    "api.wwwb",
    "assets.wwwb5hyr.picklesecurity.xyz",
    "aszocpwm.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-171.lightspeedsystems.help",
    "sounds.comems.com.lightspeedsystems.help",
    "biuwlfsd.lightspeedsystems.help",
    "bean-is-cool.anxrotjf.lightspeedsystems.help",
    "bkxawyor.lightspeedsystems.help",
    "avmbxipw.lightspeedsystems.help",
    "asset.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "awptxdfj.lightspeedsystems.help",
    "beauxfvh.lightspeedsystems.help",
    "autems.com.lightspeedsystems.help",
    "ajivntur.bg.geek.nz",
    "bean-is-cool.comauhelplightspeedsystems.com.lightspeedsystems.help",
    "awcpulhx.lightspeedsystems.help",
    "5hyrprometheus.picklesecurity.xyz",
    "138de765dfb64fabb2df296b784232fa.plex.direct",
    "bean-is-cool.bean-is-cool.comauhelplightspeedsystems.com.lightspeedsystems.help",
    "fucking-nigger-kill-yourself-162.lightspeedsystems.help",
    "amubtxze.lightspeedsystems.help",
    "auth1.itup.com.lightspeedsystems.help",
    "blog-wwwb5hyr.picklesecurity.xyz",
    "bjkleogh.lightspeedsystems.help",
    "bjupe.mesh.mongodb.netystems.com.lightspeedsystems.help",
    "akjznph.lightspeedsystems.help",
    "bldyhzjg.lightspeedsystems.help",
    "5hyrmta-sts.picklesecurity.xyz",
    "backup.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.bukmfndi.lightspeedsystems.help",
    "bean-is-cool.autems.com.lightspeedsystems.help",
    "630428a76245162875c78210.asdfghjklertyuiotgv4erdcijngbnjiflgwdifygtsdkfutysdkfuy.bg.geek.nz",
    "admin-wwwb5hyr.picklesecurity.xyz",
    "alumnigradenfurniture.topdsystems.helplightspeedsystem.lightspeedsystems.lightspeedsystems.help",
    "bean-is-cool.cbapuofl.lightspeedsystems.help",
    "71v0.mesh.mongodb.net.lightspeedsystems.help",
    "bjurpety.lightspeedsystems.help",
    "breld9.demo.westwoodcc.online310.lightspeedsystems.help",
    "bean-is-cool.bvuajpwi.lightspeedsystems.help",
    "bean-is-cool.cnksozjt.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-146.lightspeedsystems.help",
    "apmuderg.lightspeedsystems.help",
    "aqvxtzjc.lightspeedsystems.help",
    "app-wwwb5hyr.picklesecurity.xyz",
    "api.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.ayush-ranjan-watches-child-porn-173.lightspeedsystems.help",
    "bean-is-cool.bfywrzuc.bg.geek.nz",
    "bean-is-cool.mobiolink.comksdf.bg.geek.nz",
    "ayush-ranjan-watches-child-porn-353.lightspeedsystems.help",
    "blogs.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bnfumdjk.lightspeedsystems.help",
    "atlas.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "awhcsexp.lightspeedsystems.help",
    "acptijuo.bg.geek.nz",
    "acsdknhp.bg.geek.nz",
    "bqwcksnx.lightspeedsystems.help",
    "5hyr.faq.picklesecurity.xyz",
    "aryone.comalappraisers.comelplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.asfqzuto.lightspeedsystems.help",
    "y5k.info",
    "anflugxb.lightspeedsystems.help",
    "aokfvlx.lightspeedsystems.help",
    "bean-is-cool.admin.mobiolink.comksdf.bg.geek.nz",
    "asset-wwwcom.com.lightspeedsystems.help",
    "atmjikoaut.koellreutter.com",
    "blog.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "go.de.com",
    "almfeqcy.bg.geek.nz",
    "bean-is-cool.comel",
    "acaeronet.comtems.com.lightspeedsystems.help",
    "48.zendesk.com.com.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-135.lightspeedsystems.help",
    "aqciboms.lightspeedsystems.help",
    "5hyr-developer.picklesecurity.xyz",
    "aydzujmf.bg.geek.nz",
    "bean-is-cool.crifdauq.lightspeedsystems.help",
    "bkocsdxn.lightspeedsystems.help",
    "5hyr-storage.picklesecurity.xyz",
    "bqwydtox.lightspeedsystems.help",
    "aqzhopfe.lightspeedsystems.help",
    "br-in-30-seconds.pornhub.com.174.lightspeedsystems.help",
    "bean-is-cool.awptxdfj.lightspeedsystems.help",
    "beta.infusion.finance",
    "asset.wwwb5hyr.picklesecurity.xyz",
    "aupcmgxn.lightspeedsystems.help",
    "avhyzefs.lightspeedsystems.help",
    "bean-is-cool.cadecom.com.lightspeedsystems.help",
    "4erdcijngbnjiflgwdifygtsdkfutysdkfuy.bg.geek.nz",
    "apsdfgiu.lightspeedsystems.help",
    "backup.picklesecurity.xyz",
    "bean-is-cool.bjriteko.lightspeedsystems.help",
    "5hyr.picklesecurity.xyz",
    "afnxpwbd.lightspeedsystems.help",
    "bgamkoyx.lightspeedsystems.help",
    "avchrexy.lightspeedsystems.help",
    "api-web.cargaonline.com.brdevomhtspeedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "aurxdkfs.lightspeedsystems.help",
    "bru.bg.geek.nz",
    "bkwualgn.lightspeedsystems.help",
    "bbn.bg.geek.nz",
    "133.lightspeedsystems.help",
    "bpxqvfkn.bg.geek.nz",
    "101.com.np",
    "acc.wwwb",
    "bdnyzsfv.lightspeedsystems.help",
    "beanotter22100.mooo.com",
    "bean-is-cool.cfbhvyqw.lightspeedsystems.help",
    "ranjan-watches-child-porn-477.lightspeedsystems.help",
    "ajrnibtp.lightspeedsystems.help",
    "bcywdgqi.bg.geek.nz",
    "bean-is-cool.comel-blottiere.comolutions.comdsystems.com.lightspeedsystems.help",
    "amczgwuk.lightspeedsystems.help",
    "atfwpqed.lightspeedsystems.help",
    "agdnpykl.lightspeedsystems.help",
    "admin.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "amlnhkoe.lightspeedsystems.help",
    "aqizltnb.lightspeedsystems.help",
    "axbzlhjg.lightspeedsystems.help",
    "akmcdzxn.lightspeedsystems.help",
    "bmpvladw.lightspeedsystems.help",
    "akbyfswmar.saintpauljinju.com",
    "apfwvtmx.bg.geek.nz",
    "allwellnessvt.comlightspeedsystems.com.lightspeedsystems.help",
    "blog.wwwb",
    "br-in-30-seconds.pornhub.com",
    "access.wwwb",
    "beandark19100.chekanov.net",
    "bean-is-cool.bxewvsly.lightspeedsystems.help",
    "bean-is-cool.ayush-ranjan-watches-child-porn-143.lightspeedsystems.help",
    "bni.bg.geek.nz",
    "besixazm.lightspeedsystems.help",
    "adobe.coom.bg.geek.nz",
    "5hyrwww1.picklesecurity.xyz",
    "bkrntmzf.lightspeedsystems.help",
    "89e6a7a6-e287-4435-857f-bf47e2b244ca.voidtickets.xyz",
    "bean-is-cool.beauxfvh.lightspeedsystems.help",
    "ayqcsevk.bg.geek.nz",
    "ajzohmpv.lightspeedsystems.help",
    "bnjvacud.lightspeedsystems.help",
    "207752b4-959e-4095-b70a-6ffc6ca91ec5.picklesecurity.xyz",
    "4w1229hwab5.workers.deveedsystems.com.lightspeedsystems.help",
    "asode.bg.geek.nz",
    "ajvthcpe.lightspeedsystems.help",
    "afnetuqj.lightspeedsystems.help",
    "110.lightspeedsystems.help",
    "bpzrayet.lightspeedsystems.help",
    "bpnqtlyhhg.shankar101.com.np",
    "aefwlpmo.lightspeedsystems.help",
    "apps.heisse",
    "ankbhljy.bg.geek.nz",
    "bean-is-cool.centify",
    "bjl.bg.geek.nz",
    "bamcublgum.qwerty.com.ar",
    "afihqlrpsf.docucax.com.ar",
    "bkvinwcx.lightspeedsystems.help",
    "backup.wwwb5hyr.picklesecurity.xyz",
    "aujzpszabf.prixtonltd.com",
    "bpnqtlyhhg.shankar",
    "assets.wwwb",
    "abzmdlti.lightspeedsystems.help",
    "aiknqmjo.lightspeedsystems.help",
    "aetodrpn.lightspeedsystems.help",
    "adxirtqp.bg.geek.nz",
    "aiuhnhmjzg.wendyandnick.net",
    "anegsrkq.lightspeedsystems.help",
    "5hyr.conf.picklesecurity.xyz",
    "bjqxopvk.lightspeedsystems.help",
    "avihrjmt.lightspeedsystems.help",
    "105.lightspeedsystems.help",
    "api-wwwb5hyr.picklesecurity.xyz",
    "aqzmnrto.lightspeedsystems.help",
    "azuwcyen.bg.geek.nz",
    "bnkejlmx.bg.geek.nz",
    "brdegtlq.lightspeedsystems.help",
    "beanwhale17100.paulkelly.org",
    "bean-is-cool.admin.drexelbank.commystems.com.lightspeedsystems.help",
    "blog.redirected.bg.geek.nz",
    "bean-is-cool.coldwellbankerporthope.com",
    "axjprfib.lightspeedsystems.help",
    "ads.wwwcom.com.lightspeedsystems.help",
    "akejnqgv.lightspeedsystems.help",
    "azecumkj.lightspeedsystems.help",
    "5hyr.ldap.picklesecurity.xyz",
    "awscpulhx.lightspeedsystems.help",
    "bean-is-cool.csvod.comel",
    "17840j.como.uk.comom.lightspeedsystems.help",
    "bri.bg.geek.nz",
    "bean-is-cool.cuzksvny.lightspeedsystems.help",
    "aqknohmf.lightspeedsystems.help",
    "apps.heisse-reifen.deblogplightspeedsystems.com.lightspeedsystems.help",
    "anfjqhct.bg.geek.nz",
    "bean-is-cool.comthtspeedsystems.com.lightspeedsystems.help",
    "bazgqikw.bg.geek.nz",
    "alumnigradenfurniture.topdsystems.helplightspeed.lightspeedsystems.lightspeedsystems.help",
    "amoycc.comspa",
    "axyuelgt.bg.geek.nz",
    "apiqgvud.lightspeedsystems.help",
    "ayosdufl.lightspeedsystems.help",
    "bean-is-cool.auth1.itup.com.lightspeedsystems.help",
    "backup.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bolevqus.lightspeedsystems.help",
    "access.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "003eu003ewwwu003eu003ecomrs.comedsystems.com.lightspeedsystems.help",
    "adobe.org.bg.geek.nz",
    "amoycc.comspa3cartesiarte.ro.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-813.lightspeedsystems.help",
    "bean-is-cool.diwulbgn.lightspeedsystems.help",
    "avrhmiyj.lightspeedsystems.help",
    "bopctkrz.lightspeedsystems.help",
    "bean-is-cool.ayush",
    "aexhinjl.lightspeedsystems.help",
    "acc.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "asjplckn.lightspeedsystems.help",
    "bean-is-cool.com-porn-133.lightspeedsystems.help",
    "titties-201.lightspeedsystems.help",
    "akmjtcxu.lightspeedsystems.help",
    "aosdcbly.lightspeedsystems.help",
    "astizogv.lightspeedsystems.help",
    "bnjpuioa.lightspeedsystems.help",
    "banwhlof.lightspeedsystems.help",
    "ahqlopdt.lightspeedsystems.help",
    "artdamage.com.semax.com",
    "augzmwek.lightspeedsystems.help",
    "ayrvhwig.lightspeedsystems.help",
    "bean-is-cool.172.lightspeedsystems.help",
    "bean-is-cool.auth",
    "bovgwqky.bg.geek.nz",
    "bohnyqki.lightspeedsystems.help",
    "bean-is-cool.aoejvwxh.lightspeedsystems.help",
    "3cartesiarte.ro.lightspeedsystems.help",
    "aohfmicy.bg.geek.nz",
    "bgg.bg.geek.nz",
    "ayulejpqzd.velkat.org",
    "abobe.cpm.bg.geek.nz",
    "5hyr24.picklesecurity.xyz",
    "asbqfvjr.lightspeedsystems.help",
    "admin.halk.bg.geek.nz",
    "backend.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "nigger-kill-yourself-167.lightspeedsystems.help",
    "akwsqful.lightspeedsystems.help",
    "bean-is-cool.clptxsbk.lightspeedsystems.help",
    "anyuslzp.lightspeedsystems.help",
    "atdxsbjk.lightspeedsystems.help",
    "backup-wwwcom.com.lightspeedsystems.help",
    "behinha.comdsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bmhycxvs.bg.geek.nz",
    "aglyupxe.lightspeedsystems.help",
    "afqwucxp.lightspeedsystems.help",
    "bean-is-cool.comool",
    "austems.com.lightspeedsystems.help",
    "api.asdf.bg.geek.nz",
    "api.bjsyzr.com.autems.com.lightspeedsystems.help",
    "bsjoavmd.lightspeedsystems.help",
    "aejhdlun.lightspeedsystems.help",
    "bdgmlwww.www.www.csdy.org.void.radio.am",
    "bean-is-cool.15.204.209.18.ip.addr.tools",
    "amrwzsejnm.deltako.com",
    "ahvkfrug.lightspeedsystems.help",
    "boi.bg.geek.nz",
    "bacitsjv.bg.geek.nz",
    "asebconsulting.comself-234.lightspeedsystems.help",
    "assets.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "adflszfimr.rdenham.co.uk",
    "bean-is-cool.dmgakwse.lightspeedsystems.help",
    "bqjcadms.lightspeedsystems.help",
    "blsuwqex.lightspeedsystems.help",
    "beta.picklesecurity.xyz",
    "bean-is-cool.datazoid.netpro.lightspeedsystems.help",
    "547.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-165.lightspeedsystems.help",
    "bean-is-cool.bcv.bg.geek.nz",
    "ahbloesj.bg.geek.nz",
    "alypfksn.lightspeedsystems.help",
    "bcvjkqmlhfstaging.ie.lightspeedsystems.help",
    "bncgqljd.lightspeedsystems.help",
    "azknfujq.lightspeedsystems.help",
    "2006.lv.lightspeedsystems.help",
    "bagonfkptj.webuildnetworks.com",
    "bh.bg.geek.nz",
    "admin.comloadsshreelipi.comdsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "amgupdatepro.coms.com.lightspeedsystems.help",
    "backend-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bazfgtei.bg.geek.nz",
    "bmzkdwgkki.dhakalashok.com.np",
    "atobe.com.bg.geek.nz",
    "advuenty.lightspeedsystems.help",
    "axmjroef.bg.geek.nz",
    "acrolepress.abobe.com.bg.geek.nz",
    "aqvxempo.lightspeedsystems.help",
    "alcafndxuc.sprinkul.com",
    "bean-is-cool.app.orlypedia.comcominaonline.websitecom.lightspeedsystems.help",
    "bqmmmkefjz.tice-industries.com",
    "almigzcd.lightspeedsystems.help",
    "acwzuedx.lightspeedsystems.help",
    "bean-is-cool.aeyzicnx.lightspeedsystems.help",
    "bjehtowq.bg.geek.nz",
    "administrator.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "atlas.wwwb",
    "adwquvpr.lightspeedsystems.help",
    "5hyr-backend.picklesecurity.xyz",
    "bean-is-cool.ayush-ranjan-watches-child-porn-170.lightspeedsystems.help",
    "afkqzyhc.lightspeedsystems.help",
    "aqhsgpoz.lightspeedsystems.help",
    "bean-is-cool.cnhovdazdxwatermellon.bg.geek.nz",
    "bgj.bg.geek.nz",
    "anthes.orgger",
    "anmuqwlh.lightspeedsystems.help",
    "beta.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "brickwize-solution.comtspeedsystems.com.lightspeedsystems.help",
    "backup.com.lightspeedsystems.help",
    "breld9.demo.westwoodcc.online",
    "bdgmlcsdy.org.void.radio.am",
    "0451saibo.comsystems.help.lightspeedsystems.help",
    "atovdqjf.lightspeedsystems.help",
    "axzuonpc.lightspeedsystems.help",
    "bean-is-cool.artisticsurvival.comm.mxcom.lightspeedsystems.help",
    "bcu.bg.geek.nz",
    "bean-is-cool.duoifpsx.lightspeedsystems.help",
    "beanviking26100.vlaves.bg",
    "begoywmj.lightspeedsystems.help",
    "beta.wwwb5hyr.picklesecurity.xyz",
    "bhpxorgs.lightspeedsystems.help",
    "5hyr.www",
    "fucking-nigger-kill-yourself-175.lightspeedsystems.help",
    "75.com",
    "axiscorporationgroup.coml-you-fucking-nigger-kill-yourself-514.lightspeedsystems.help",
    "ayocdkbnwp.quipasur.cl",
    "bean-is-cool.com",
    "brmfpuzg.lightspeedsystems.help",
    "amierdth.bg.geek.nz",
    "brimbank.churchcitadel",
    "auihdui27187.voidtickets.xyz",
    "app.deightspeedsystems.com.lightspeedsystems.help",
    "amesqzfl.bg.geek.nz",
    "beta.com.lightspeedsystems.help",
    "aykrgqsh.lightspeedsystems.help",
    "app.wwwb5hyr.picklesecurity.xyz",
    "ayush-ranjan-watches-child-porn-160.lightspeedsystems.help",
    "aghvftds.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-129.lightspeedsystems.help",
    "bazxjush.lightspeedsystems.help",
    "ajvqpsfn.bg.geek.nz",
    "aksxhvpm.lightspeedsystems.help",
    "5hyrdocs.picklesecurity.xyz",
    "acc-wwwcom.com.lightspeedsystems.help",
    "arwoznsq.lightspeedsystems.help",
    "app-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.comcomomm.lightspeedsystems.help",
    "asset.wwwcom.com.lightspeedsystems.help",
    "5hyr-oauth.picklesecurity.xyz",
    "bhuyxsgv.lightspeedsystems.help",
    "almhvgpu.lightspeedsystems.help",
    "bean-is-cool.arwjbmhx.bg.geek.nz",
    "ads.wwwb",
    "avtipybe.lightspeedsystems.help",
    "awpqcudg.bg.geek.nz",
    "admin.asdfghjklertyuiotgv4erdcijngbnjiflgwdifygtsdkfutysdkfuy.bg.geek.nz",
    "5hyrplugins.picklesecurity.xyz",
    "77y47.comstems.com.lightspeedsystems.help",
    "amlxilewvd.ambiserve.com",
    "becwmuxh.bg.geek.nz",
    "bhjgsvfo.bg.geek.nz",
    "bgr.bg.geek.nz",
    "bjcehgrs.bg.geek.nz",
    "bozwnqfy.lightspeedsystems.help",
    "breekiehhoo.bg.geek.nz",
    "bdtiqxkw.lightspeedsystems.help",
    "abhilfeklage.netcom.com.lightspeedsystems.help",
    "ackup.stonestars.sitedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "backup.wwwcom.com.lightspeedsystems.help",
    "administrator.wwwcom.com.lightspeedsystems.help",
    "aqtsnmlp.lightspeedsystems.help",
    "blogs-wwwb5hyr.picklesecurity.xyz",
    "3c08aa2d-4028-4375-9340-35890c15fa98.lightspeedsystems.help",
    "app.wwwcom.com.lightspeedsystems.help",
    "bean-is-cool.comghtspeedsystem.com.lightspeedsystems.help",
    "asnvjlxp.lightspeedsystems.help",
    "bdangozm.bg.geek.nz",
    "bean-is-cool.co.zam.tws.com.lightspeedsystems.help",
    "bbqyjlrmej.srmck.com",
    "bgstracking.comlf",
    "belnoajz.lightspeedsystems.help",
    "arsd.siteedarcom.it",
    "brctpeyi.bg.geek.nz",
    "asc.bg.geek.nz",
    "actxsjmb.lightspeedsystems.help",
    "admin-wwwcom.com.lightspeedsystems.help",
    "atlas.com.lightspeedsystems.help",
    "brmctkvl.lightspeedsystems.help",
    "aclrwbzp.lightspeedsystems.help",
    "atqowdnh.lightspeedsystems.help",
    "anrwhjzv.lightspeedsystems.help",
    "adbe.com.bg.geek.nz",
    "abobd.bg.geek.nz",
    "anyehbxk.lightspeedsystems.help",
    "adoupkvg.bg.geek.nz",
    "bocjrlqf.bg.geek.nz",
    "138de765dfb64fabb2df296b784232fa.plex.direct-kill-yourself-672.lightspeedsystems.help",
    "blottiere.comolutions.comdsystems.com.lightspeedsystems.help",
    "bean-is-cool.cthzvpaf.lightspeedsystems.help",
    "awrcqxez.lightspeedsystems.help",
    "assets.wwwcom.com.lightspeedsystems.help",
    "apbrlyue.lightspeedsystems.help",
    "anbvtpqbfc.anich-anich.com",
    "asibdeyc.lightspeedsystems.help",
    "atlas-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "168.lightspeedsystems.help",
    "ace.comom.lightspeedsystems.help",
    "asnyjvur.lightspeedsystems.help",
    "bdpnuais.lightspeedsystems.help",
    "5hyr-ads.picklesecurity.xyz",
    "blog.wwwb5hyr.picklesecurity.xyz",
    "bg.bg.geek.nz",
    "beta-wwwb5hyr.picklesecurity.xyz",
    "bmhkxfgo.lightspeedsystems.help",
    "yourself-635.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-150.lightspeedsystems.help",
    "afptmjdo.bg.geek.nz",
    "bean-is-cool.ayush-ranjan-watches-child-porn-171.lightspeedsystems.help",
    "1964falconforsale.commcat.db",
    "bean-is-cool.centify-eg.comlplightspeedsystems.com.lightspeedsystems.help",
    "atfvdwsh.bg.geek.nz",
    "bqjnfsgh.lightspeedsystems.help",
    "bsgcidur.bg.geek.nz",
    "you-fucking-nigger-kill-yourself-514.lightspeedsystems.help",
    "aurorahomei.comscam.orgstreak.cocking-nigger-kill-yourself-167.lightspeedsystems.help",
    "autoconfig.allianceperformance.orgcom.lightspeedsystems.help",
    "alioedgk.bg.geek.nz",
    "aqfjxszg.lightspeedsystems.help",
    "agjduhke.lightspeedsystems.help",
    "beanjaguar21100.amq.ro",
    "adpnewone.com.renaissance-go.de.com",
    "bnygxvow.lightspeedsystems.help",
    "administrator-wwwb5hyr.picklesecurity.xyz",
    "apaffoijph.ozium",
    "210.lightspeedsystems.help",
    "5hyr.beta.picklesecurity.xyz",
    "ayjkmzin.lightspeedsystems.help",
    "ranjan-watches-child-porn-143.lightspeedsystems.help",
    "arswpiqu.bg.geek.nz",
    "autobomben.deystems.com.lightspeedsystems.help",
    "bgstracking.comlf-210.lightspeedsystems.help",
    "azupsonk.bg.geek.nz",
    "app.wwwb",
    "atdwcsqn.lightspeedsystems.help",
    "azvleqrc.lightspeedsystems.help",
    "aumcpesi.lightspeedsystems.help",
    "auhcbgwm.lightspeedsystems.help",
    "bean-is-cool.directems.com.lightspeedsystems.help",
    "is-cool.comauhelplightspeedsystems.com.lightspeedsystems.help",
    "ayqwbwwwclient.16jhoncrossingroad.bg.geek.nz",
    "administrator.picklesecurity.xyz",
    "afbdlhsq.lightspeedsystems.help",
    "brvxowjf.lightspeedsystems.help",
    "blog.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "6ohncrossroad.bg.geek.nz",
    "beanmaster15100.cky.cl",
    "bella.come.rocomcom.lightspeedsystems.help",
    "bgztaeok.lightspeedsystems.help",
    "ajfihusc.lightspeedsystems.help",
    "ainlrjtq.lightspeedsystems.help",
    "aluminiumgardenfurniture.topdsystems.helplightspeedsystems.lightspeedsystems.help",
    "ankftuvg.lightspeedsystems.help",
    "armnkvhw.lightspeedsystems.help",
    "apps.ecommerce",
    "avyqwsrf.lightspeedsystems.help",
    "artpclogin.i-ready.com.bg.geek.nz",
    "bhsmptau.lightspeedsystems.help",
    "access-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.cnrkside.comghtspeedsystem.com.lightspeedsystems.help",
    "blpkjioeyp.estudiocustode.com.ar",
    "aaaasdfghjklkjhgfertyytrdxf44nmkjhgdbghyyyyytffffffflyhffgh99f.bg.geek.nz",
    "beanbright19100.shakemanor.com",
    "bean-is-cool.bgocio-sounds.comems.com.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-172.lightspeedsystems.help",
    "be.belgium.besk.com.com.lightspeedsystems.help",
    "acc.com.lightspeedsystems.help",
    "aebugjfk.lightspeedsystems.help",
    "bean-is-cool.conseils-bricolo.frger-kill-yourself-234.lightspeedsystems.help",
    "backup.wwwb",
    "axcnigwj.lightspeedsystems.help",
    "a.bg.geek.nz",
    "brkuijmf.lightspeedsystems.help",
    "adpnewone.com.renaissance",
    "bgt.bg.geek.nz",
    "bean-is-cool.com.165.lightspeedsystems.help",
    "alecbryansmythe.the.bg.geek.nz",
    "18.ip.addr.tools",
    "ads-wwwcom.com.lightspeedsystems.help",
    "bean-is-cool.crbfxsid.lightspeedsystems.help",
    "bfxpgdzy.lightspeedsystems.help",
    "bgrtjhwy.lightspeedsystems.help",
    "h2897493.stratoserver.net",
    "avpxtzqd.lightspeedsystems.help",
    "acviohdu.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-169.lightspeedsystems.help",
    "avlwybtp.lightspeedsystems.help",
    "bean-is-cool.dqvwccomwc",
    "bean-is-cool.dremcnvk.lightspeedsystems.help",
    "bprdoein.lightspeedsystems.help",
    "bhoyceal.lightspeedsystems.help",
    "asset.wwwb",
    "acbzkpwn.lightspeedsystems.help",
    "aostcjyf.lightspeedsystems.help",
    "avcpnksi.bg.geek.nz",
    "beta.infusion.finance-547.lightspeedsystems.help",
    "bfgldnzr.lightspeedsystems.help",
    "bjfkords.lightspeedsystems.help",
    "bjgxboemhk.tudormihaiservsrl.ro",
    "ayush-ranjan-watches-child-porn-130.lightspeedsystems.help",
    "reifen.deblogplightspeedsystems.com.lightspeedsystems.help",
    "bdzqiwpo.lightspeedsystems.help",
    "bgyvqrxi.lightspeedsystems.help",
    "aebvpjwc.lightspeedsystems.help",
    "adobe.comm.bg.geek.nz",
    "bean-is-cool.cloudfront.net.nbg.bg.geek.nz",
    "argfjmst.lightspeedsystems.help",
    "bgf.bg.geek.nz",
    "1964falconforsale.commcat.db-app.deightspeedsystems.com.lightspeedsystems.help",
    "blog.bcsdny.org.void.radio.am",
    "acrobe.com.a.bg.geek.nz",
    "ayush-ranjan-watches-child-porn-998.lightspeedsystems.help",
    "auol-you-fucking-nigger-kill-yourself-171.lightspeedsystems.help",
    "bjncmiat.lightspeedsystems.help",
    "bean-is-cool.comdsshreelipi.comdsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "16j0hncrossroad.bg.geek.nz",
    "assets-wwwb5hyr.picklesecurity.xyz",
    "bean-is-cool.ayush-ranjan-watches-child-porn-477.lightspeedsystems.help",
    "asljfgaeroiugaerliu.lightspeedsystems.help",
    "bdisptwzim.masplene.com",
    "bean-is-cool.bdlxqrek.lightspeedsystems.help",
    "biouynvs.lightspeedsystems.help",
    "antioniores3.bg.geek.nz",
    "bhqjkczetb.fluffandflog.com",
    "bcparnlk.lightspeedsystems.help",
    "acc.wwwb5hyr.picklesecurity.xyz",
    "blog-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "blogs.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "aigqhmmtnq.mfc-krsulin.ru",
    "2.picklesecurity.xyz",
    "aexnzbut.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-163.lightspeedsystems.help",
    "aqszwoxu.lightspeedsystems.help",
    "bean-is-cool.baygzptn.lightspeedsystems.help",
    "antu.bg.geek.nz",
    "autu.bg.geek.nz",
    "administrator-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "adobd.bg.geek.nz",
    "beanbeast24100.netava.ro",
    "adope.com.bg.geek.nz",
    "akfzrecnwr.neugiergarten.de",
    "atlas-wwwcom.com.lightspeedsystems.help",
    "access.com.lightspeedsystems.help",
    "310.lightspeedsystems.help",
    "ajlerhwt.lightspeedsystems.help",
    "bmjdzwkc.lightspeedsystems.help",
    "801dpondroad.bg.geek.nz",
    "04148.zendesk.com.com.lightspeedsystems.help",
    "bean-is-cool.dmwjgatp.lightspeedsystems.help",
    "bezuvuhkuf.acconboy.com",
    "bkwpuqga.bg.geek.nz",
    "anupcmob.bg.geek.nz",
    "backup-wwwb5hyr.picklesecurity.xyz",
    "bml.bg.geek.nz",
    "brv.bg.geek.nz",
    "bean-is-cool.aoekfqlc.lightspeedsystems.help",
    "asset-wwwb5hyr.picklesecurity.xyz",
    "administrator-wwwcom.com.lightspeedsystems.help",
    "aequtpzk.lightspeedsystems.help",
    "azoakoklbx.pd",
    "artdamage.com.semax.com.h2897493.stratoserver.net-yourself-635.lightspeedsystems.help",
    "aqxaeisgko.geoecon.info",
    "abickyjs.lightspeedsystems.help",
    "begdktrj.lightspeedsystems.help",
    "abch.bg.geek.nz",
    "bag.bg.geek.nz",
    "bean-madethis25100.eduarmor.com",
    "ayush-ranjan-watches-child-porn-134.lightspeedsystems.help",
    "630428a76245162875c78210.superidoldexiaorong.lightspeedsystems.help",
    "ranjan-watches-child-porn-173.lightspeedsystems.help",
    "ahipxzqs.bg.geek.nz",
    "assets-wwwcom.com.lightspeedsystems.help",
    "appdb.nethhhhhh.bg.geek.nz",
    "bean-is-cool.dlyxfsgu.lightspeedsystems.help",
    "ajsqbwtd.lightspeedsystems.help",
    "bpckjuyi.lightspeedsystems.help",
    "aygcrxprip.becktothegarden.com",
    "atstore.asset.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "altyshqi.lightspeedsystems.help",
    "bax.bg.geek.nz",
    "betwoongiris.cfd.lightspeedsystems.help",
    "aqoljmve.lightspeedsystems.help",
    "kill-yourself-234.lightspeedsystems.help",
    "amzzsfjjhq.veterinarianativa.cl",
    "administrator.wwwb5hyr.picklesecurity.xyz",
    "3b2604148.zendesk.com.com.lightspeedsystems.help",
    "arexkvsd.lightspeedsystems.help",
    "awktuah2.bg.geek.nz",
    "awojclpq.lightspeedsystems.help",
    "bean-is-cool.you",
    "industries.com",
    "bean-is-cool.comool-you-fucking-nigger-kill-yourself-175.lightspeedsystems.help",
    "bquptikm.lightspeedsystems.help",
    "porn-166.lightspeedsystems.help",
    "asset.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "artpci-ready.com.bg.geek.nz",
    "bean-hawk22100.vanmeir.ch",
    "beta.wwwb",
    "ads.wwwb5hyr.picklesecurity.xyz",
    "acnlshru.lightspeedsystems.help",
    "acc.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "ashaaloha.orgquicktoom.lightspeedsystems.help",
    "askhjrfu.lightspeedsystems.help",
    "arsarestaurante.es-titties-201.lightspeedsystems.help",
    "api.picklesecurity.xyz",
    "bdcnwmyt.lightspeedsystems.help",
    "booksforus.grupofarma.com.ar",
    "blog-wwwcom.com.lightspeedsystems.help",
    "bpltkswj.bg.geek.nz",
    "krsulin.ru",
    "bean-is-cool.dqvwccomwc2006.lv.lightspeedsystems.help",
    "aihucnzg.lightspeedsystems.help",
    "aruxeqcv.lightspeedsystems.help",
    "adbsymen.bg.geek.nz",
    "bijrxcsz.lightspeedsystems.help",
    "blogs-wwwcom.com.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-139.lightspeedsystems.help",
    "awxpmyvu.lightspeedsystems.help",
    "ajmxhyqb.lightspeedsystems.help",
    "app.comloadsshreelipi.comdsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "atovdqif.lightspeedsystems.help",
    "atxqhdmu.lightspeedsystems.help",
    "beanhawk14100.y5k.info",
    "bmrdefyn.bg.geek.nz",
    "aztlosidem.copytek.cl",
    "brg.bg.geek.nz",
    "ranjan-watches-child-porn-170.lightspeedsystems.help",
    "ager.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bgs.bg.geek.nz",
    "blogs-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "5hyr-builds.picklesecurity.xyz",
    "agikrsjx.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-341.lightspeedsystems.help",
    "blogs.picklesecurity.xyz",
    "bean-is-cool.you-fucking-nigger-kill-yourself-162.lightspeedsystems.help",
    "assets.picklesecurity.xyz",
    "5hyr-grafana.picklesecurity.xyz",
    "aeciqxot.lightspeedsystems.help",
    "agrsepbh.lightspeedsystems.help",
    "bcogtzea.lightspeedsystems.help",
    "ads.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "anthes.orgger-kill-yourself-151.lightspeedsystems.help",
    "axqpkzcy.lightspeedsystems.help",
    "bgiesvkr.lightspeedsystems.help",
    "blog.com.vnsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "aluminiumgardenfurniture.topsystems.helplightspeedsystems.lightspeedsystems.help",
    "auslpozg.bg.geek.nz",
    "bean-is-cool.ayjungbd.lightspeedsystems.help",
    "bsglxjda.lightspeedsystems.help",
    "bmero-id99.workers.devharizzlersnotsigma.lightspeedsystems.help",
    "brt.bg.geek.nz",
    "blogs.wwwb",
    "aelcmhyb.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-407.lightspeedsystems.help",
    "bmyegiso.lightspeedsystems.help",
    "benyouzv.lightspeedsystems.help",
    "assets.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "api-wwwcom.com.lightspeedsystems.help",
    "axjtfrmh.lightspeedsystems.help",
    "ads-wwwb5hyr.picklesecurity.xyz",
    "bhcsfoqm.lightspeedsystems.help",
    "bhsfoljm.lightspeedsystems.help",
    "amgcesxw.lightspeedsystems.help",
    "backend-wwwb5hyr.picklesecurity.xyz",
    "bean-is-cool.cotlbexw.lightspeedsystems.help",
    "api.google.bassmanbenny.com",
    "axyirsdv.bg.geek.nz",
    "alumnigradenfurniture.topdsytems.helplightspeedsystems.lightspeedsystems.lightspeedsystems.help",
    "alliedbroking.comom.lightspeedsystems.help",
    "bifrmlye.lightspeedsystems.help",
    "acrobe.com",
    "arsarestaurante.es",
    "adpubsqh.lightspeedsystems.help",
    "630428a76245162875c78210.asdfghjklertyuiotgv",
    "kill-yourself-672.lightspeedsystems.help",
    "afevjpow.lightspeedsystems.help",
    "akhryzli.lightspeedsystems.help",
    "abonlhqw.lightspeedsystems.help",
    "akdrhyflwa.e-rezerwacje24.pl",
    "abode.cpm.bg.geek.nz",
    "bean-is-cool.bzsevacg.lightspeedsystems.help",
    "345.org",
    "aubdfkzh.lightspeedsystems.help",
    "analytics.ticket-x.comcomrenelmondo.itcom.com.lightspeedsystems.help",
    "alfxnieh.bg.geek.nz",
    "ayfqkxui.lightspeedsystems.help",
    "azmxyvuw.bg.geek.nz",
    "bean-is-cool.com.lightspeedsystems.helphelplightspeedysystems.com.lightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.cgjykebq.lightspeedsystems.help",
    "ahdisclx.lightspeedsystems.help",
    "anyuqxil.lightspeedsystems.help",
    "asumhopk.bg.geek.nz",
    "bgkianor.lightspeedsystems.help",
    "arjhlgxf.lightspeedsystems.help",
    "afrtkdbw.lightspeedsystems.help",
    "bar.bg.geek.nz",
    "avfdjiwp.lightspeedsystems.help",
    "bean-is-cool.bywsumid.lightspeedsystems.help",
    "bko.bg.geek.nz",
    "ranjan-watches-child-porn-171.lightspeedsystems.help",
    "10.048.deusdfsdfsdfsd.void.radio.am",
    "acfinbgd.lightspeedsystems.help",
    "befoital.co.nzlplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.dev.conseils",
    "admin.helpco.zaa.lightspeedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "answeron.comms.helplightspeedsystems.com.lightspeedsystems.help",
    "ascenciabank.comool",
    "ayush-ranjan-watches-child-porn-133.lightspeedsystems.help",
    "biufgtmh.lightspeedsystems.help",
    "azrodpkf.lightspeedsystems.help",
    "kill-yourself-175.lightspeedsystems.help",
    "ayqwtfnx.lightspeedsystems.help",
    "backend-wwwcom.com.lightspeedsystems.help",
    "alhkdbjp.lightspeedsystems.help",
    "bhdckjlf.bg.geek.nz",
    "abxnrdoy.lightspeedsystems.help",
    "blogs.com.lightspeedsystems.help",
    "bjsyzr.com.autems.com.lightspeedsystems.help",
    "bean-dark11100.largent.org",
    "applbees.bg.geek.nz",
    "amdjbwig.bg.geek.nz",
    "azaueidkmx.jorgefidel.com.ar",
    "baliqonr.lightspeedsystems.help",
    "access.wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "akeivqgj.bg.geek.nz",
    "beta-wwwcom.com.lightspeedsystems.help",
    "backend.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.bgocio",
    "9xl.com.bg.geek.nz",
    "ahydodgbkk.kshitizpaudel.com.np",
    "alewrxnj.lightspeedsystems.help",
    "bdiuhpft.lightspeedsystems.help",
    "bean-is-cool.byt.bg.geek.nz",
    "bean-is-cool.comm.mxcom.lightspeedsystems.help",
    "bean-is-cool.dlrxifwp.lightspeedsystems.help",
    "bean-is-cool.dngsvaoq.lightspeedsystems.help",
    "brdevomhtspeedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "agrxqfnj.lightspeedsystems.help",
    "cpa.comhild",
    "aotrfxly.lightspeedsystems.help",
    "36.toptems.com.lightspeedsystems.help",
    "15-204-209-18.cprapid.com",
    "atlanta.suitepenthouse.comstems.com.lightspeedsystems.help",
    "bbrqipvtxc.ultrav.us",
    "besk.com.com.lightspeedsystems.help",
    "ahuixgbr.lightspeedsystems.help",
    "bg.geek.nz.lightspeedsystems.help",
    "bkswctui.lightspeedsystems.help",
    "3www.cartesiarte.ro.lightspeedsystems.help",
    "beanphantom23100.nhactruoc",
    "ads.picklesecurity.xyz",
    "bjnodszt.lightspeedsystems.help",
    "bean-is-cool.dygcwzlp.lightspeedsystems.help",
    "brh.bg.geek.nz",
    "aqnomsbc.bg.geek.nz",
    "axqwbocs.bg.geek.nz",
    "bean-is-cool.afspyokj.lightspeedsystems.help",
    "ascnjdxm.lightspeedsystems.help",
    "bean-is-cool.169.lightspeedsystems.help",
    "bean-is-cool.aretvxgu.lightspeedsystems.help",
    "access-wwwb5hyr.picklesecurity.xyz",
    "amdnwsbi.lightspeedsystems.help",
    "bdhystui.lightspeedsystems.help",
    "blog.wwwcom.com.lightspeedsystems.help",
    "bean-is-cool.bswkolmp.lightspeedsystems.help",
    "bean-is-cool.16johnossroad.bg.geek.nz",
    "azoakoklbx.pd345.org",
    "au.bgstracking.comlf",
    "api-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bjglipca.lightspeedsystems.help",
    "axwshpoc.lightspeedsystems.help",
    "biusflhe.lightspeedsystems.help",
    "afcnriot.lightspeedsystems.help",
    "234.lightspeedsystems.help",
    "atjxnrsc.lightspeedsystems.help",
    "bkytfcaw.lightspeedsystems.help",
    "acc-wwwb5hyr.picklesecurity.xyz",
    "bgh.bg.geek.nz",
    "beta.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "5hyr.www2.picklesecurity.xyz",
    "aehtlpqj.lightspeedsystems.help",
    "br8a986263b2604148.zendesk.com.com.lightspeedsystems.help",
    "1.itup.com.lightspeedsystems.help",
    "porn-133.lightspeedsystems.help",
    "axkgirfv.lightspeedsystems.help",
    "arvuiwdq.lightspeedsystems.help",
    "asset-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "assets.gitlab.artmon.ru13.lightspeedsystems.help",
    "arcnfqsp.lightspeedsystems.help",
    "awztu.bg.geek.nz",
    "bean-is-cool.dev.conseils-bricolo.frger-kill-yourself-234.lightspeedsystems.help",
    "bean-is-cool.csmkhyqt.lightspeedsystems.help",
    "bgyepsjbce.edificiomalecon.com.ar",
    "backend.picklesecurity.xyz",
    "access.wwwb5hyr.picklesecurity.xyz",
    "bean-is-cool.comect.toom.lightspeedsystems.help",
    "bean-is-cool.csvod.comel-blottiere.comolutions.comdsystems.com.lightspeedsystems.help",
    "bean-is-cool.aphszcjg.lightspeedsystems.help",
    "arxrauofgr.colacu.ro",
    "174.lightspeedsystems.help",
    "alztvbvovi.thetubes.net",
    "asxvondy.lightspeedsystems.help",
    "backup-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "brhupvai.lightspeedsystems.help",
    "ajumzrke.bg.geek.nz",
    "5hyr2017.picklesecurity.xyz",
    "adeob.com.bg.geek.nz",
    "aqlnmviy.lightspeedsystems.help",
    "bldhjsuz.lightspeedsystems.help",
    "aphwnyhwyz.pedrinhoracing.com.br",
    "amlckofj.lightspeedsystems.help",
    "bean-is-cool.ctmywzpj.lightspeedsystems.help",
    "bqzbunizzvstaging.software.bg.geek.nz",
    "access-wwwcom.com.lightspeedsystems.help",
    "beekihioo.bg.geek.nz",
    "adjlnzob.lightspeedsystems.help",
    "api.alec.bg.geek.nz",
    "beu.bg.geek.nz",
    "api.wwwb5hyr.picklesecurity.xyz",
    "048.deusdfsdfsdfsd.void.radio.am",
    "blocking.console.lightspeedsystems.help",
    "adkeiszr.lightspeedsystems.help",
    "bgo.bg.geek.nz",
    "bljuiyhr.bg.geek.nz",
    "0dao1.com.cnms.com.lightspeedsystems.help",
    "bmwbjwairt.chhetriswornim.com.np",
    "atndbkpw.lightspeedsystems.help",
    "bfmxkwpv.lightspeedsystems.help",
    "bean-is-cool.ayibqtzr.lightspeedsystems.help",
    "bean-is-cool.baodxjht.lightspeedsystems.help",
    "aimfsowz.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-166.lightspeedsystems.help",
    "abpjgltx.lightspeedsystems.help",
    "asebconsulting.comself",
    "ahpkgnwj.lightspeedsystems.help",
    "b.ixl.com.bg.geek.nz",
    "ads.com.lightspeedsystems.help",
    "addon-stimmeqch.stimmeq.chstems.com.lightspeedsystems.help",
    "adoeb.com.bg.geek.nz",
    "azkkjbfrqo.commwebworks.com",
    "brhjdqle.lightspeedsystems.help",
    "amoycc.comspa3www.cartesiarte.ro.lightspeedsystems.help",
    "b2h-bituahaleumi.comompeedsystems.com.lightspeedsystems.help",
    "bheotknz.lightspeedsystems.help",
    "bhhz.bg.geek.nz",
    "agenda-rottweil.deure.topdsystems.helplightspeedsystem.lightspeedsystems.lightspeedsystems.help",
    "blog.gitlab.artmon.ru",
    "ayush-ranjan-watches-child-porn-141.lightspeedsystems.help",
    "bean-is-cool.czhgyxlf.lightspeedsystems.help",
    "administrator.wwwb",
    "6766.herokuspace.comr",
    "adeuxokg.lightspeedsystems.help",
    "aliowyjh.lightspeedsystems.help",
    "beatsbydrecom.us.comisers.comelplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.ahgblztn.lightspeedsystems.help",
    "avtxldng.bg.geek.nz",
    "bean-is-cool.bjzndtci.lightspeedsystems.help",
    "aynzfpjr.lightspeedsystems.help",
    "app.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "belgium.besk.com.com.lightspeedsystems.help",
    "akbrwtnp.lightspeedsystems.help",
    "azndgqmv.lightspeedsystems.help",
    "analytics.ticket",
    "13.lightspeedsystems.help",
    "amzsbvlf.lightspeedsystems.help",
    "bid.bg.geek.nz",
    "apcbsrql.lightspeedsystems.help",
    "azlfqxiium.henryaveiga.com",
    "aimkzwqb.bg.geek.nz",
    "bgewsvcq.lightspeedsystems.help",
    "abmzgwlp.lightspeedsystems.help",
    "advxnyig.lightspeedsystems.help",
    "atlas.picklesecurity.xyz",
    "arkta.bg.geek.nz",
    "azxwokmp.lightspeedsystems.help",
    "bgd.bg.geek.nz",
    "bqmmmkefjz.tice",
    "admin.picklesecurity.xyz",
    "bean-is-cool.cebxndwi.lightspeedsystems.help",
    "1.org",
    "bean-is-cool.comnt.net.bg.geek.nz",
    "brug.bg.geek.nz",
    "atlas.wwwcom.com.lightspeedsystems.help",
    "16jhoncrossingroad.bg.geek.nz",
    "blog.gitlab.artmon.ru13.lightspeedsystems.help",
    "bgjdxvry.lightspeedsystems.help",
    "api.bcsdny.com.de",
    "bean-is-cool.bean",
    "brc.bg.geek.nz",
    "actxypgq.lightspeedsystems.help",
    "aqjbpfmd.bg.geek.nz",
    "axckhiqu.lightspeedsystems.help",
    "x.comcomrenelmondo.itcom.com.lightspeedsystems.help",
    "atlas.wwwb5hyr.picklesecurity.xyz",
    "avlsnbrw.bg.geek.nz",
    "bean-is-cool.comfkbgdfgbradiubgiruuirstyisdjbkjsdbbvsuebviusbenvjk.bg.geek.nz",
    "bean-bright15100.tikagautam.com.np",
    "au.bgstracking.comlf-210.lightspeedsystems.help",
    "app-wwwcom.com.lightspeedsystems.help",
    "bean-is-cool.you-fucking-nigger-kill-yourself-175.lightspeedsystems.help",
    "bean-is-cool.cgqynoak.lightspeedsystems.help",
    "adyktnrs.lightspeedsystems.help",
    "bnc.bg.geek.nz",
    "axzgklun.lightspeedsystems.help",
    "bgifnxjv.lightspeedsystems.help",
    "bmxiepns.lightspeedsystems.help",
    "blogs.wwwcom.com.lightspeedsystems.help",
    "bhg.bg.geek.nz",
    "e-rezerwacje24.pl",
    "bjtavecbyn.jsalfa.com.ar",
    "aemlkwuv.lightspeedsystems.help",
    "brh-rhs-ostalb.depeedsystems.com.lightspeedsystems.help",
    "bdyzhwrl.lightspeedsystems.help",
    "aftegrdl.lightspeedsystems.help",
    "atlas-wwwb5hyr.picklesecurity.xyz",
    "admin.tcd.roielution.ithtspeedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "ads-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "atlas.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.sounds.comems.com.lightspeedsystems.help",
    "bean-is-cool.dflsjkrb.lightspeedsystems.help",
    "ads.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "apaffoijph.ozium1.org",
    "beantest.rolotec.ro",
    "bja.bg.geek.nz",
    "amjcvsgi.lightspeedsystems.help",
    "bdaxkvcp.bg.geek.nz",
    "bean-is-cool.amubtxze.lightspeedsystems.help",
    "bjlshpfn.bg.geek.nz",
    "assets.gitlab.artmon.ru",
    "bean-is-cool.comizzawitney.co.uks.com.lightspeedsystems.help",
    "asset.com.lightspeedsystems.help",
    "bricolo.frger",
    "asset.picklesecurity.xyz",
    "bean-is-cool.czrnguvd.lightspeedsystems.help",
    "acc.wwwcom.com.lightspeedsystems.help",
    "abkgcplx.lightspeedsystems.help",
    "bamndygt.lightspeedsystems.help",
    "bean-is-cool.akwesdrq.lightspeedsystems.help",
    "bfg.bg.geek.nz",
    "admin.wwwcom.com.lightspeedsystems.help",
    "axrfliks.lightspeedsystems.help",
    "bchevnpq.lightspeedsystems.help",
    "beanlord8100.ltlegl.com",
    "blfvhutz.lightspeedsystems.help",
    "aurorahomei.comscam.orgstreak.cocking",
    "bean-is-cool.cxenfkqp.lightspeedsystems.help",
    "adope.cpm.bg.geek.nz",
    "aoqizmhx.lightspeedsystems.help",
    "ayush-ranjan-watches-child-porn-831.lightspeedsystems.help",
    "ahsjmvlx.bg.geek.nz",
    "beanphantom23100.nhactruoc75.com",
    "6741.bsfa.info",
    "ahedkoun.lightspeedsystems.help",
    "blog.picklesecurity.xyz",
    "auqjkeol.lightspeedsystems.help",
    "begdxhau.lightspeedsystems.help",
    "awhgmixc.lightspeedsystems.help",
    "acc.picklesecurity.xyz",
    "blmngxyu.bg.geek.nz",
    "ayush-ranjan-watches-child-porn.lightspeedsystems.help",
    "bot.virtualbitcoinbank.comcom.lightspeedsystems.help",
    "kill-yourself-151.lightspeedsystems.help",
    "ahrdktmu.lightspeedsystems.help",
    "bean-is-cool.dkfvboai.lightspeedsystems.help",
    "apjumtzy.lightspeedsystems.help",
    "access.wwwcom.com.lightspeedsystems.help",
    "bean-is-cool.ayjtqxec.lightspeedsystems.help",
    "bnzoylje.lightspeedsystems.help",
    "amzcldxj.bg.geek.nz",
    "bmwlbchpmj.condesys.ch",
    "aluminiumgardenfurniture.topdsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "apps.ecommerce-cpa.comhild-porn-166.lightspeedsystems.help",
    "atzfmjpx.bg.geek.nz",
    "ascenciabank.comool-you-fucking-nigger-kill-yourself-175.lightspeedsystems.help",
    "adobebe.com.bg.geek.nz",
    "asynlreu.lightspeedsystems.help",
    "165.lightspeedsystems.help",
    "baz.bg.geek.nz",
    "awomxdhb.bg.geek.nz",
    "bg.geek.nz",
    "bggpuiplcw.biranchipoudyal.com.np",
    "bfy.bg.geek.nz",
    "au.com.lightspeedsystems.help",
    "630428a76245162875c78210.maxwellwangfromoaktonhighschoolspremiumproxy.lightspeedsystems.help",
    "anich.com",
    "administrator.com.lightspeedsystems.help",
    "ayfmqhdc.lightspeedsystems.help",
    "bkguaton.lightspeedsystems.help",
    "app.artisticsurvival.comm.mxcom.lightspeedsystems.help",
    "bmhtvonk.lightspeedsystems.help",
    "apsrvktx.lightspeedsystems.help",
    "brmgyjzp.lightspeedsystems.help",
    "afszywrk.lightspeedsystems.help",
    "aejphiru.lightspeedsystems.help",
    "axiscorporationgroup.coml",
    "bpsqjuxa.lightspeedsystems.help",
    "app.picklesecurity.xyz",
    "bean-is-cool.coldwellbankerporthope.com-porn-133.lightspeedsystems.help",
    "bkgzdpqj.lightspeedsystems.help",
    "acroleexpress.adobe.com.bg.geek.nz",
    "agcfiykp.lightspeedsystems.help",
    "arjzdycl.lightspeedsystems.help",
    "brimbank.churchcitadel-6766.herokuspace.comr-kill-yourself-175.lightspeedsystems.help",
    "acc-wwwsportsmatstore.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "administrator.comedsystems.helplightspeedsystems.com.lightspeedsystems.help",
    "bean-is-cool.bjkleogh.lightspeedsystems.help",
    "bjydctul.lightspeedsystems.help",
    "void.verandahotels.com",
    "mcf.ekivotos.gr",
    "eoyxd.openchain.pt",
    "xdx.wiki.gd",
    "emif.bad.mn",
    "meny.iiiii.info",
    "atn.openchain.pt",
    "tqedy.wiki.gd",
    "bhf.ekivotos.gr",
    "getw.bad.mn",
    "kes.iiiii.info",
    "pxnv.photo-frame.com",
    "iwusa.120v.ac",
    "ihrw.r-o-o-t.net",
    "yruzl.d-n-s.name",
    "jce.k22.su",
    "graduation-ye.b-cdn.net",
    "late-registration.b-cdn.net",
    "donda-2.b-cdn.net",
    "bully-ye.b-cdn.net",
    "ye-ye.b-cdn.net",
    "frozen-education.technology",
    "tglscistuff.starlighteducation.42web.io",
    "vps-4954cc9c.vps.ovh.us",
    "understand-science.ccwu.cc",
    "tglsc.c00lkiddtech.live",
    "london.foundation.wiki.gd",
    "calculas.apmath.ccwu.cc",
    "ckisbad.gap-peace.org",
    "willie-taylor-42.b-cdn.net",
    "samuel-cox-28.b-cdn.net",
    "randy-johnson-99.b-cdn.net",
    "bryan-ramirez-38.b-cdn.net",
    "alexander-murphy-15.b-cdn.net",
    "tglsc.bestspark.org",
    "eraser-marker-3276.b-cdn.net",
    "eraser-notebook-5226.b-cdn.net",
    "backpack-auditorium-4802.b-cdn.net",
    "ixl.host.safe.delystigemusikanter.com",
    "history10927.b-cdn.net",
    "banenamesame.lovable.app",
    "cdn.jsdeli",
    "194d38cfbcb3.surge.sh",
    "7feb4fab6ae2.surge.sh",
    "787449740cba.surge.sh",
    "844a911ddc92.surge.sh",
    "8e3500c1ff2a.surge.sh",
    "ddb17981d986.surge.sh",
    "7ce02d4b651f.surge.sh",
    "6e8dbb65da70.surge.sh",
    "d204ce739f3e.surge.sh",
    "7509d31ee9c2.surge.sh",
    "2255c993b875.surge.sh",
    "d5db82e6e802.surge.sh",
    "47fd02051f1a.surge.sh",
    "56e3270e13b0.surge.sh",
    "a31f77d30b52.surge.sh",
    "bf23413a8b0f.surge.sh",
    "bc3ee3946281.surge.sh",
    "b1d5e2ada698.surge.sh",
    "e5e0fdadab81.surge.sh",
    "16c2c13d4585.surge.sh",
    "c6bfc7d7dc4f.surge.sh",
    "6146c88bcb96.surge.sh",
    "c9324ef29b83.surge.sh",
    "1fb574ca5a1b.surge.sh",
    "204d00c619ce.surge.sh",
    "1629cda2e43b.surge.sh",
    "092102adb81f.surge.sh",
    "25114874c354.surge.sh",
    "546064348b47.surge.sh",
    "d4fddd5babc7.surge.sh",
    "arcade-classroom.s3.amazonaws.com",
    "brain-arcade1.s3.amazonaws.com",
    "classquiz-hub7.s3.amazonaws.com",
    "edu-gamespot4.s3.amazonaws.com",
    "exam-arcade2.s3.amazonaws.com",
    "game-lessons7.s3.amazonaws.com",
    "homework-games5.s3.amazonaws.com",
    "learnplay-zone6.s3.amazonaws.com",
    "lesson-arcade8.s3.amazonaws.com",
    "math-playzone3.s3.amazonaws.com",
    "playstudy-hub9.s3.amazonaws.com",
    "quiz-funtime3.s3.amazonaws.com",
    "quizplay-spot5.s3.amazonaws.com",
    "read-funtime9.s3.amazonaws.com",
    "school-games2.s3.amazonaws.com",
    "science-playhub.s3.amazonaws.com",
    "studyfun-zone8.s3.amazonaws.com",
    "studyhall-arcade1.s3.amazonaws.com",
    "algebra.math.student.lecture.geometry.fiwers.cl",
    "computer.algebra.classroom.english.physics.breadtime.com.my",
    "literature.technology.learning.library.drama.cyceron.ai",
    "teacher.computer.vocabulary.engineering.assignment.fiwers.cl",
    "computer.programming.technology.math.teacher.breadtime.com.my",
    "geometry.studying.learning.reading.biology.cyceron.ai",
    "grammar.physics.vocabulary.algebra.homework.fiwers.cl",
    "seminar.chemistry.grammar.reading.computer.breadtime.com.my",
    "assignment.history.campus.teacher.library.cyceron.ai",
    "student.math.campus.geometry.lecture.fiwers.cl",
    "homework.engineering.studying.drama.reading.breadtime.com.my",
    "campus.computer.english.drama.programming.cyceron.ai",
    "science.physics.grammar.project.computer.breadtime.com.my",
    "math.calculus.english.lecture.physics.fiwers.cl",
    "writing.music.assignment.chemistry.reading.cyceron.ai",
    "english.teacher.classroom.science.library.breadtime.com.my",
    "engineering.geometry.literature.programming.project.breadtime.com.my",
    "drama.student.computer.calculus.science.breadtime.com.my",
    "art.classroom.campus.homework.chemistry.breadtime.com.my",
    "calculus.physics.technology.science.music.breadtime.com.my",
    "archer.ro",
    "unblocked-games-66.com",
    "unblocked-games-76.com",
    "unblocked-games-77.com",
    "unblocked-games-99.com",
    "shootingames.com",
    "classroom.onl",
    "ekidsgames.com",
    "ro.games",
    "dungeon.ro",
    "gamestoplay.io",
    "lich.games",
    "mobilegames.online",
    "77unblockedgames.com",
    "shooting-games.net",
    "unblockedgames.online",
    "dragongames.online",
    "julgame.com",
    "random-link.com",
    "random-proxy.com",
    "weslack.com",
    "82091e1299ab.surge.sh",
    "8669f10742d5.surge.sh",
    "fea7a4abc6b0.surge.sh",
    "fd04cb985515.surge.sh",
    "8b12a88e4ab4.surge.sh",
    "eb167b1d229c.surge.sh",
    "d0abf44b5ae5.surge.sh",
    "01d7f1765c5f.surge.sh",
    "4369a9f0dd09.surge.sh",
    "14b63827b2c5.surge.sh",
    "3e06cfa90a40.surge.sh",
    "a5cdd9ba73f7.surge.sh",
    "e820594b8467.surge.sh",
    "001bd550efb9.surge.sh",
    "735cf663d9e3.surge.sh",
    "ddee5f88e278.surge.sh",
    "05d4d0848248.surge.sh",
    "5ff1a39030fb.surge.sh",
    "529d4337ddb3.surge.sh",
    "20e4e7d5c738.surge.sh",
    "85d0bdc30a59.surge.sh",
    "4a1e4df09e87.surge.sh",
    "502a81c906f8.surge.sh",
    "d9be1e2fcef0.surge.sh",
    "77ea52563c21.surge.sh",
    "910889228cc3.surge.sh",
    "de200d329025.surge.sh",
    "702ddf654664.surge.sh",
    "db18595f9992.surge.sh",
    "19d030915db0.surge.sh",
    "ik.imagekit.io",
    "saugatr-pencil735366.agrointegral.cl",
    "saugatrastra-cacw.creative-words.se",
    "sixseven.chanka.com",
    "astra-education.top",
    "pencil210815-saugatr.tux.to",
    "saugatrlunar-uicvr.xcel.ch",
    "marker657439-saugatr.agrointegral.cl",
    "tech511408-saugatr.eeeertwfvsgs.xyz",
    "0putlocker.org",
    "gn-mathchrisets.s3.us-east-1.amazonaws.com",
    "readingsets.s3.us-east-1.amazonaws.com",
    "bedroque.s3.amazonaws.com",
    "spanish-class.scottbaptist.com",
    "bullpxbklol.s3.amazonaws.com",
    "bulltop.s3.amazonaws.com",
    "dzbjxct0c9fxq.cloudfront.net",
    "kraja.barkmail.net",
    "vertex-os-official.netlify.app",
];

// Exact path-scoped exceptions for specific shared-host URLs.
// These DO NOT approve the entire shared host.
const DEFAULT_ALLOWED_URL_PREFIXES = [
    "https://storage.googleapis.com/lilicraftzone/",
    "https://s3.amazonaws.com/mathhub/",
    "https://s3.amazonaws.com/deskloft/",
];

const EXTRA_ALLOWED_URL_PREFIXES = String(
    process.env.ALLOWED_URL_PREFIXES || ""
)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

const ALLOWED_URL_PREFIXES = Array.from(
    new Set([
        ...DEFAULT_ALLOWED_URL_PREFIXES,
        ...EXTRA_ALLOWED_URL_PREFIXES
    ])
);


const EXTRA_ALLOWED_HOSTS = String(process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

function normalizeAllowedHostEntry(value) {
    const raw = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");

    // Host allowlist entries must be hostnames only.
    // Reject full URLs, paths, queries, fragments, ports, and whitespace.
    if (
        !raw ||
        raw.includes("://") ||
        /[\/\\?#:\s]/.test(raw)
    ) {
        return "";
    }

    return normalizeHost(raw);
}

const ALLOWED_HOSTS = Array.from(
    new Set(
        [...DEFAULT_ALLOWED_HOSTS, ...EXTRA_ALLOWED_HOSTS]
            .map(normalizeAllowedHostEntry)
            .filter(Boolean)
    )
).sort();

let SITE_CATALOG = [];
let SITE_CATALOG_ALIASES = new Map();
let SITE_CATALOG_SOURCE = "";
let SITE_CATALOG_ERROR = "";

function addCatalogAlias(alias, url) {
    const cleanAlias = String(alias || "").trim();
    const cleanUrl = String(url || "").trim();

    if (!cleanAlias || !cleanUrl) {
        return;
    }

    if (!SITE_CATALOG_ALIASES.has(cleanUrl)) {
        SITE_CATALOG_ALIASES.set(cleanUrl, new Set());
    }

    SITE_CATALOG_ALIASES
        .get(cleanUrl)
        .add(cleanAlias);
}

function ingestCatalogValue(value) {
    if (typeof value === "string") {
        const url = value.trim();
        return url ? url : null;
    }

    if (value && typeof value === "object") {
        const url =
            String(
                value.url ||
                value.href ||
                value.link ||
                ""
            ).trim();

        if (!url) {
            return null;
        }

        if (value.name) {
            addCatalogAlias(value.name, url);
        }

        if (Array.isArray(value.aliases)) {
            for (const alias of value.aliases) {
                addCatalogAlias(alias, url);
            }
        }

        return url;
    }

    return null;
}

try {
    const preferred = [
        "SCHOOLIO_URL_CATALOG_UPDATED.json",
        "SCHOOLIO_URL_CATALOG.json"
    ];

    const discovered = fs
        .readdirSync(__dirname)
        .filter(name => (
            /^SCHOOLIO_URL_CATALOG.*\.json$/i.test(name)
        ))
        .sort((a, b) => (
            preferred.indexOf(a) - preferred.indexOf(b)
        ));

    const ordered = Array.from(
        new Set([
            ...preferred.filter(name => (
                fs.existsSync(path.join(__dirname, name))
            )),
            ...discovered
        ])
    );

    const catalogName = ordered[0];

    if (catalogName) {
        const catalogPath =
            path.join(__dirname, catalogName);

        const parsed =
            JSON.parse(
                fs.readFileSync(catalogPath, "utf8")
            );

        let rawItems = [];

        if (Array.isArray(parsed)) {
            rawItems = parsed;
        }
        else if (parsed && typeof parsed === "object") {
            rawItems =
                parsed.urls ||
                parsed.items ||
                parsed.entries ||
                parsed.catalog ||
                [];

            if (
                parsed.aliases &&
                typeof parsed.aliases === "object"
            ) {
                for (
                    const [alias, target] of
                    Object.entries(parsed.aliases)
                ) {
                    const targets =
                        Array.isArray(target)
                            ? target
                            : [target];

                    for (const url of targets) {
                        addCatalogAlias(alias, url);
                    }
                }
            }
        }

        SITE_CATALOG = Array.from(
            new Set(
                rawItems
                    .map(ingestCatalogValue)
                    .filter(Boolean)
            )
        );

        SITE_CATALOG_SOURCE = catalogName;
    }
}
catch (error) {
    SITE_CATALOG_ERROR =
        String(error && error.message || error);

    console.warn(
        "Could not load Schoolio URL catalog:",
        SITE_CATALOG_ERROR
    );
}

function normalizeHost(hostname) {
    return String(hostname || "")
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");
}

function editDistance(a, b) {
    const left = String(a || "");
    const right = String(b || "");
    const rows = right.length + 1;
    const cols = left.length + 1;
    const matrix = Array.from(
        { length: rows },
        () => Array(cols).fill(0)
    );

    for (let i = 0; i < rows; i++) matrix[i][0] = i;
    for (let j = 0; j < cols; j++) matrix[0][j] = j;

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const cost =
                right[i - 1] === left[j - 1] ? 0 : 1;

            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[rows - 1][cols - 1];
}

function sanitizeTypedUrl(value) {
    let raw = String(value || "").trim();

    if (!raw) {
        return "";
    }

    raw = raw
        .replace(/^[`"'\s]+|[`"'\s]+$/g, "")
        .replace(/\\/g, "/")
        .replace(/^https?\s*:\s*\/+\s*/i, "https://")
        .replace(/^https?\s*\/+\s*/i, "https://")
        .replace(/^www\s*\.\s*/i, "www.")
        .replace(/\s*\.\s*/g, ".")
        .replace(/\s*\/\s*/g, "/");

    if (
        /^[a-z]+:\/\//i.test(raw) &&
        !/^https?:\/\//i.test(raw)
    ) {
        return "";
    }

    if (!/^https?:\/\//i.test(raw)) {
        raw = "https://" + raw;
    }

    return raw;
}

function findAllowedHostCorrection(hostname) {
    const original = normalizeHost(hostname);
    const bare = original.replace(/^www\./, "");

    if (isAllowedHost(original)) {
        return original;
    }

    if (!bare.includes(".")) {
        const exactLabelMatches =
            ALLOWED_HOSTS.filter(domain => (
                domain.split(".")[0] === bare
            ));

        if (exactLabelMatches.length === 1) {
            return exactLabelMatches[0];
        }
    }

    let best = null;
    let bestDistance = Infinity;

    for (const allowed of ALLOWED_HOSTS) {
        const candidate = normalizeHost(allowed);
        const distance = editDistance(bare, candidate);
        const limit = candidate.length >= 10 ? 2 : 1;

        if (
            distance <= limit &&
            distance < bestDistance
        ) {
            best = candidate;
            bestDistance = distance;
        }
    }

    if (!best) {
        return null;
    }

    return original.startsWith("www.")
        ? "www." + best
        : best;
}

function autocorrectTypedUrl(value) {
    const sanitized = sanitizeTypedUrl(value);

    if (!sanitized) {
        return null;
    }

    let url;

    try {
        url = new URL(sanitized);
    } catch {
        return null;
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        return null;
    }

    const correctedHost =
        findAllowedHostCorrection(url.hostname);

    if (
        correctedHost &&
        normalizeHost(correctedHost) !==
        normalizeHost(url.hostname)
    ) {
        url.hostname = correctedHost;
    }

    return url;
}

function isAllowedHost(hostname) {
    const host = normalizeHost(hostname);

    return ALLOWED_HOSTS.some(domain => (
        host === domain ||
        host.endsWith("." + domain)
    ));
}

function isAllowedUrlPrefix(url) {
    if (!url) {
        return false;
    }

    return ALLOWED_URL_PREFIXES.some(value => {
        try {
            const prefix = new URL(value);

            return (
                url.protocol === prefix.protocol &&
                normalizeHost(url.hostname) ===
                    normalizeHost(prefix.hostname) &&
                url.pathname.startsWith(prefix.pathname)
            );
        } catch {
            return false;
        }
    });
}

function isAllowedUrl(url) {
    return (
        Boolean(url) &&
        (
            isAllowedHost(url.hostname) ||
            isAllowedUrlPrefix(url)
        )
    );
}

function parseHttpUrl(input, base) {
    try {
        const url = base
            ? new URL(String(input), base)
            : new URL(String(input));

        if (!["http:", "https:"].includes(url.protocol)) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

function isPrivateIPv4(ip) {
    const parts = ip.split(".").map(Number);

    if (
        parts.length !== 4 ||
        parts.some(value => Number.isNaN(value))
    ) {
        return true;
    }

    const [a, b] = parts;

    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
    );
}

function isPrivateIPv6(ip) {
    const value = String(ip || "").toLowerCase();

    if (value.startsWith("::ffff:")) {
        const mapped = value.slice(7);
        return net.isIPv4(mapped)
            ? isPrivateIPv4(mapped)
            : true;
    }

    return (
        value === "::" ||
        value === "::1" ||
        value.startsWith("fc") ||
        value.startsWith("fd") ||
        value.startsWith("fe80:")
    );
}

function isPrivateIP(ip) {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);
    return true;
}

async function validateUrl(input) {
    const original = String(input || "");
    const sanitized = sanitizeTypedUrl(original);
    const url = autocorrectTypedUrl(original);

    if (!url) {
        throw new Error("Invalid HTTP/HTTPS URL");
    }

    if (url.username || url.password) {
        throw new Error("URLs with embedded credentials are not supported");
    }

    if (!isAllowedUrl(url)) {
        throw new Error("Website is not in the Schoolio allowlist");
    }

    const addresses = await dns.lookup(url.hostname, { all: true });

    if (!addresses.length) {
        throw new Error("Could not resolve hostname");
    }

    for (const item of addresses) {
        if (isPrivateIP(item.address)) {
            throw new Error("Private/internal network addresses are blocked");
        }
    }

    url.schoolioCorrected =
        Boolean(sanitized) &&
        sanitized !== url.href;

    return url;
}

function proxyUrl(target) {
    return "/proxy?url=" + encodeURIComponent(String(target));
}

function shouldSkipUrl(value) {
    const raw = String(value || "").trim();

    return (
        !raw ||
        raw.startsWith("#") ||
        /^(data|blob|javascript|mailto|tel|about):/i.test(raw)
    );
}

function rewriteUrl(value, baseUrl) {
    if (shouldSkipUrl(value)) {
        return value;
    }

    const absolute = parseHttpUrl(value, baseUrl);

    if (!absolute) {
        return value;
    }

    if (!isAllowedUrl(absolute)) {
        return "/blocked?url=" + encodeURIComponent(absolute.href);
    }

    return proxyUrl(absolute.href);
}

function rewriteSrcset(srcset, baseUrl) {
    return String(srcset || "")
        .split(",")
        .map(part => {
            const bits = part.trim().split(/\s+/);

            if (!bits[0]) {
                return part;
            }

            bits[0] = rewriteUrl(bits[0], baseUrl);
            return bits.join(" ");
        })
        .join(", ");
}

function rewriteCss(css, baseUrl) {
    let output = String(css || "");

    output = output.replace(
        /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
        (match, quote, raw) => {
            if (shouldSkipUrl(raw)) {
                return match;
            }

            const rewritten = rewriteUrl(raw, baseUrl);
            return `url(${quote}${rewritten}${quote})`;
        }
    );

    output = output.replace(
        /@import\s+(?:url\()?\s*(['"])(.*?)\1\s*\)?/gi,
        (match, quote, raw) => {
            const rewritten = rewriteUrl(raw, baseUrl);
            return `@import ${quote}${rewritten}${quote}`;
        }
    );

    return output;
}

function rewriteJavaScript(js, baseUrl) {
    let output = String(js || "");

    // Conservative rewriting for common ES module import forms.
    output = output.replace(
        /(\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?)(['"])([^'"]+)\2/g,
        (match, prefix, quote, specifier) => {
            if (shouldSkipUrl(specifier)) return match;
            const rewritten = rewriteUrl(specifier, baseUrl);
            return `${prefix}${quote}${rewritten}${quote}`;
        }
    );

    output = output.replace(
        /(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
        (match, prefix, quote, specifier, suffix) => {
            if (shouldSkipUrl(specifier)) return match;
            const rewritten = rewriteUrl(specifier, baseUrl);
            return `${prefix}${quote}${rewritten}${quote}${suffix}`;
        }
    );

    return output;
}

function runtimeShim(pageUrl) {
    const target = JSON.stringify(pageUrl);

    return `
<script>
(() => {
    const SCHOOLIO_TARGET = ${target};

    function toProxy(value) {
        try {
            const raw =
                value instanceof URL
                    ? value.href
                    : String(value || "");

            if (
                raw.startsWith(location.origin + "/proxy?url=") ||
                raw.startsWith("/proxy?url=") ||
                raw.startsWith("/blocked?url=") ||
                /^(data|blob|javascript|mailto|tel|about):/i.test(raw)
            ) {
                return raw;
            }

            const absolute = new URL(raw, SCHOOLIO_TARGET);

            if (!/^https?:$/i.test(absolute.protocol)) {
                return raw;
            }

            return "/proxy?url=" + encodeURIComponent(absolute.href);
        } catch {
            return value;
        }
    }

    const nativeFetch = window.fetch.bind(window);

    window.fetch = function(input, init) {
        try {
            if (input instanceof Request) {
                input = new Request(toProxy(input.url), input);
            } else {
                input = toProxy(input);
            }
        } catch {}

        return nativeFetch(input, init);
    };

    const nativeXhrOpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        return nativeXhrOpen.call(this, method, toProxy(url), ...rest);
    };

    if (window.EventSource) {
        const NativeEventSource = window.EventSource;
        window.EventSource = function(url, config) {
            return new NativeEventSource(toProxy(url), config);
        };
        window.EventSource.prototype = NativeEventSource.prototype;
    }

    if (navigator.sendBeacon) {
        const nativeBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => nativeBeacon(toProxy(url), data);
    }

    const nativeOpen = window.open;

    window.open = function(url, ...args) {
        return nativeOpen.call(window, toProxy(url), ...args);
    };

    document.addEventListener("click", event => {
        const anchor = event.target && event.target.closest
            ? event.target.closest("a[href]")
            : null;

        if (anchor) {
            anchor.href = toProxy(anchor.getAttribute("href"));
        }
    }, true);

    document.addEventListener("submit", event => {
        const form = event.target;

        if (form && form.action) {
            form.action = toProxy(form.action);
        }
    }, true);
})();
</script>`;
}

function rewriteHtml(html, pageUrl) {
    const $ = cheerio.load(String(html || ""), {
        decodeEntities: false
    });

    // Target CSP/meta refresh rules can conflict with rewritten proxy resources.
    $('meta[http-equiv]').each((_, element) => {
        const equiv = String($(element).attr("http-equiv") || "").toLowerCase();

        if (equiv === "content-security-policy") {
            $(element).remove();
        }

        if (equiv === "refresh") {
            const content = String($(element).attr("content") || "");
            const match = content.match(/^\s*(\d+(?:\.\d+)?)\s*;\s*url\s*=\s*(.+)\s*$/i);

            if (match) {
                $(element).attr(
                    "content",
                    `${match[1]};url=${rewriteUrl(match[2], pageUrl)}`
                );
            }
        }
    });

    const attrs = [
        ["a[href]", "href"],
        ["link[href]", "href"],
        ["img[src]", "src"],
        ["script[src]", "src"],
        ["iframe[src]", "src"],
        ["source[src]", "src"],
        ["video[src]", "src"],
        ["audio[src]", "src"],
        ["input[src]", "src"],
        ["track[src]", "src"],
        ["embed[src]", "src"],
        ["object[data]", "data"],
        ["form[action]", "action"]
    ];

    for (const [selector, attr] of attrs) {
        $(selector).each((_, element) => {
            const current = $(element).attr(attr);

            if (current) {
                $(element).attr(
                    attr,
                    rewriteUrl(current, pageUrl)
                );
            }
        });
    }

    $("[srcset]").each((_, element) => {
        const value = $(element).attr("srcset");

        if (value) {
            $(element).attr(
                "srcset",
                rewriteSrcset(value, pageUrl)
            );
        }
    });

    $("style").each((_, element) => {
        const css = $(element).html();

        if (css) {
            $(element).html(rewriteCss(css, pageUrl));
        }
    });

    $("[style]").each((_, element) => {
        const css = $(element).attr("style");

        if (css) {
            $(element).attr(
                "style",
                rewriteCss(css, pageUrl)
            );
        }
    });

    // Rewritten CSS/module resources no longer necessarily match target SRI hashes.
    $("[integrity]").removeAttr("integrity");

    $("a[target='_top'], a[target='_parent'], a[target='_blank']")
        .attr("target", "_self");

    $("form[target='_top'], form[target='_parent'], form[target='_blank']")
        .attr("target", "_self");

    const shim = runtimeShim(pageUrl);

    if ($("head").length) {
        $("head").prepend(shim);
    } else {
        $.root().prepend(shim);
    }

    return $.html();
}

function escapeHtml(value) {
    return String(value || "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char])
    );
}

function cookiePrefix(hostname) {
    const digest = crypto
        .createHash("sha256")
        .update(normalizeHost(hostname))
        .digest("hex")
        .slice(0, 12);

    return `__sio_${digest}_`;
}

function targetCookieHeader(cookieHeader, hostname) {
    if (!cookieHeader) return "";

    const prefix = cookiePrefix(hostname);
    const output = [];

    for (const part of String(cookieHeader).split(";")) {
        const trimmed = part.trim();
        const equals = trimmed.indexOf("=");

        if (equals <= 0) continue;

        const name = trimmed.slice(0, equals);
        const value = trimmed.slice(equals + 1);

        if (name.startsWith(prefix)) {
            output.push(
                name.slice(prefix.length) + "=" + value
            );
        }
    }

    return output.join("; ");
}

function splitSetCookie(headerValue) {
    if (!headerValue) return [];

    // Handles the common combined-header case while avoiding commas inside Expires.
    return String(headerValue)
        .split(/,(?=\s*[^;,=\s]+=[^;,]*)/)
        .map(value => value.trim())
        .filter(Boolean);
}

function getSetCookies(headers) {
    if (
        headers &&
        typeof headers.getSetCookie === "function"
    ) {
        return headers.getSetCookie();
    }

    return splitSetCookie(
        headers ? headers.get("set-cookie") : ""
    );
}

function rewriteSetCookie(cookie, hostname) {
    const parts = String(cookie || "")
        .split(";")
        .map(part => part.trim())
        .filter(Boolean);

    if (!parts.length) return null;

    const first = parts.shift();
    const equals = first.indexOf("=");

    if (equals <= 0) return null;

    const originalName = first.slice(0, equals).trim();
    const value = first.slice(equals + 1);
    const attributes = [];
    let hasHttpOnly = false;

    for (const attr of parts) {
        const lower = attr.toLowerCase();

        if (
            lower.startsWith("expires=") ||
            lower.startsWith("max-age=")
        ) {
            attributes.push(attr);
        } else if (lower === "httponly") {
            hasHttpOnly = true;
        }
    }

    attributes.push("Path=/");
    attributes.push("Secure");
    attributes.push("SameSite=None");

    if (hasHttpOnly) {
        attributes.push("HttpOnly");
    }

    return (
        cookiePrefix(hostname) +
        originalName +
        "=" +
        value +
        "; " +
        attributes.join("; ")
    );
}

function buildTargetHeaders(req, targetUrl) {
    const headers = new Headers();

    const passthrough = [
        "accept",
        "accept-language",
        "content-type",
        "range",
        "if-none-match",
        "if-modified-since",
        "cache-control",
        "pragma"
    ];

    for (const name of passthrough) {
        const value = req.headers[name];

        if (value) {
            headers.set(name, String(value));
        }
    }

    headers.set(
        "user-agent",
        req.headers["user-agent"] ||
        "Mozilla/5.0 SchoolioProxy/5.0"
    );

    const cookies = targetCookieHeader(
        req.headers.cookie,
        targetUrl.hostname
    );

    if (cookies) {
        headers.set("cookie", cookies);
    }

    // Many applications expect same-origin Origin/Referer values.
    if (req.headers.origin) {
        headers.set("origin", targetUrl.origin);
    }

    if (req.headers.referer) {
        headers.set("referer", targetUrl.href);
    }

    return headers;
}

function loadAllowedCatalogVariants() {
    const seen = new Set();
    const output = [];

    for (const value of SITE_CATALOG) {
        const url = parseHttpUrl(value);

        if (!url || !isAllowedUrl(url)) {
            continue;
        }

        const key = url.href.toLowerCase();

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        output.push({
            type: "variant",
            host: normalizeHost(url.hostname),
            url: url.href,
            label: url.hostname + url.pathname
        });
    }

    return output;
}

const ALLOWED_CATALOG_VARIANTS = loadAllowedCatalogVariants();

app.get("/", (req, res) => {
    res.type("html").send(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${VERSION}</title>
<style>
body{margin:0;padding:40px;font-family:Arial,sans-serif;background:#070707;color:#eee}
.box{max-width:760px;margin:auto;padding:28px;border:1px solid #222;border-radius:16px;background:#0d0d0d}
h1{color:#ff263d;margin-top:0}
.ok{color:#73d889}
code{display:block;padding:10px;background:#050505;border-radius:8px;color:#aaa;overflow-wrap:anywhere}
</style>
</head>
<body>
<div class="box">
<h1>${VERSION}</h1>
<p class="ok">● ONLINE</p>
<p>${ALLOWED_HOSTS.length} allowed base domains.</p>
<p>${ALLOWED_CATALOG_VARIANTS.length} catalog URL variations currently match the allowlist.</p>
<code>/proxy?url=https%3A%2F%2Fen.wikipedia.org%2F</code>
</div>
</body>
</html>`);
});

app.get("/api/test", (req, res) => {
    res.json({
        working: true,
        message: "Schoolio connected successfully!",
        version: VERSION,
        allowedDomains: ALLOWED_HOSTS.length,
        allowedUrlPrefixes: ALLOWED_URL_PREFIXES.length,
        catalogUrls: SITE_CATALOG.length,
        catalogAliases: Array.from(SITE_CATALOG_ALIASES.values())
            .reduce((sum, aliases) => sum + aliases.size, 0),
        catalogSource: SITE_CATALOG_SOURCE,
        catalogError: SITE_CATALOG_ERROR || null,
        allowedCatalogVariants: ALLOWED_CATALOG_VARIANTS.length
    });
});

app.get("/api/allowed", (req, res) => {
    res.json({
        count: ALLOWED_HOSTS.length,
        domains: ALLOWED_HOSTS
    });
});

app.get("/api/allowed-sites", (req, res) => {
    const query = String(req.query.q || "")
        .trim()
        .toLowerCase();

    const requestedLimit = Number(req.query.limit || 200);
    const limit = Math.min(
        Math.max(
            Number.isFinite(requestedLimit)
                ? requestedLimit
                : 200,
            1
        ),
        500
    );

    const roots = ALLOWED_HOSTS.map(host => ({
        type: "domain",
        host,
        label: host,
        url: "https://" + host + "/"
    }));

    let items;

    if (!query) {
        items = roots.slice(0, limit);
    } else {
        const matchedRoots = roots.filter(item => (
            item.host.includes(query) ||
            item.url.toLowerCase().includes(query)
        ));

        const matchedVariants = ALLOWED_CATALOG_VARIANTS.filter(item => (
            item.host.includes(query) ||
            item.url.toLowerCase().includes(query)
        ));

        const seen = new Set();
        items = [];

        for (const item of [...matchedRoots, ...matchedVariants]) {
            const key = item.url.toLowerCase();

            if (seen.has(key)) continue;
            seen.add(key);
            items.push(item);

            if (items.length >= limit) break;
        }
    }

    res.json({
        query,
        allowedDomains: ALLOWED_HOSTS.length,
        allowedCatalogVariants: ALLOWED_CATALOG_VARIANTS.length,
        returned: items.length,
        items
    });
});

app.get("/api/sites", (req, res) => {
    const requestedLimit = Number(req.query.limit || 200);
    const requestedOffset = Number(req.query.offset || 0);

    const limit = Math.min(
        Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1),
        500
    );

    const offset = Math.max(
        Number.isFinite(requestedOffset)
            ? requestedOffset
            : 0,
        0
    );

    const items = SITE_CATALOG.slice(offset, offset + limit);

    res.json({
        total: SITE_CATALOG.length,
        offset,
        limit,
        returned: items.length,
        items
    });
});

function normalizeCatalogSearch(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[._\-/:?#=&%]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function compactCatalogSearch(value) {
    return normalizeCatalogSearch(value)
        .replace(/[^a-z0-9]+/g, "");
}

let SITE_CATALOG_SEARCH_INDEX = null;

function getCatalogSearchIndex() {
    if (SITE_CATALOG_SEARCH_INDEX) {
        return SITE_CATALOG_SEARCH_INDEX;
    }

    SITE_CATALOG_SEARCH_INDEX =
        SITE_CATALOG.map(url => {
            let hostname = "";

            try {
                hostname = new URL(url).hostname;
            }
            catch {}

            const bareHost =
                hostname
                    .toLowerCase()
                    .replace(/^www\./, "");

            const aliases =
                Array.from(
                    SITE_CATALOG_ALIASES.get(url) ||
                    []
                );

            return {
                url,
                hostname,
                aliases,
                name:
                    aliases.length
                        ? aliases[0]
                        : "",
                lowerUrl:
                    url.toLowerCase(),
                bareHost,
                normalizedUrl:
                    normalizeCatalogSearch(url),
                normalizedHost:
                    normalizeCatalogSearch(bareHost),
                compactUrl:
                    compactCatalogSearch(url),
                compactHost:
                    compactCatalogSearch(bareHost),
                normalizedAliases:
                    aliases.map(alias => (
                        normalizeCatalogSearch(alias)
                    )),
                compactAliases:
                    aliases.map(alias => (
                        compactCatalogSearch(alias)
                    ))
            };
        });

    return SITE_CATALOG_SEARCH_INDEX;
}

function scoreCatalogEntry(entry, rawQuery) {
    const query =
        String(rawQuery || "")
            .trim()
            .toLowerCase();

    const normalizedQuery =
        normalizeCatalogSearch(query);

    const compactQuery =
        compactCatalogSearch(query);

    if (!normalizedQuery) {
        return null;
    }

    const aliasExact =
        entry.normalizedAliases
            .some(alias => alias === normalizedQuery);

    if (aliasExact) {
        return 0;
    }

    const aliasPrefix =
        entry.normalizedAliases
            .some(alias => alias.startsWith(normalizedQuery));

    if (aliasPrefix) {
        return 2;
    }

    const aliasContains =
        entry.normalizedAliases
            .some(alias => alias.includes(normalizedQuery));

    if (aliasContains) {
        return 4;
    }

    if (
        entry.lowerUrl === query ||
        entry.bareHost === query
    ) {
        return 6;
    }

    if (
        entry.lowerUrl.startsWith(query) ||
        entry.bareHost.startsWith(query)
    ) {
        return 8;
    }

    if (
        entry.lowerUrl.includes(query) ||
        entry.bareHost.includes(query)
    ) {
        return 10;
    }

    if (
        entry.normalizedHost === normalizedQuery ||
        entry.normalizedUrl === normalizedQuery
    ) {
        return 12;
    }

    if (
        entry.normalizedHost.startsWith(normalizedQuery) ||
        entry.normalizedUrl.startsWith(normalizedQuery)
    ) {
        return 14;
    }

    if (
        entry.normalizedHost.includes(normalizedQuery) ||
        entry.normalizedUrl.includes(normalizedQuery)
    ) {
        return 16;
    }

    const tokens =
        normalizedQuery
            .split(" ")
            .filter(Boolean);

    if (
        tokens.length > 1 &&
        tokens.every(token => (
            entry.normalizedUrl.includes(token) ||
            entry.normalizedAliases
                .some(alias => alias.includes(token))
        ))
    ) {
        return 20;
    }

    if (!compactQuery) {
        return null;
    }

    const compactTargets = [
        ...entry.compactAliases,
        entry.compactHost
    ].filter(Boolean);

    for (const target of compactTargets) {
        if (target.startsWith(compactQuery)) {
            return 22;
        }

        if (target.includes(compactQuery)) {
            return 24;
        }
    }

    const allowedDistance =
        compactQuery.length >= 12
            ? 3
            : compactQuery.length >= 7
                ? 2
                : 1;

    for (const target of compactTargets) {
        if (
            Math.abs(
                target.length - compactQuery.length
            ) > allowedDistance
        ) {
            continue;
        }

        if (
            compactQuery.length >= 4 &&
            target[0] !== compactQuery[0]
        ) {
            continue;
        }

        const distance =
            editDistance(
                compactQuery.slice(0, 64),
                target.slice(0, 64)
            );

        if (distance <= allowedDistance) {
            return 30 + distance;
        }
    }

    return null;
}

app.get("/api/catalog-status", (req, res) => {
    res.json({
        loaded: SITE_CATALOG.length > 0,
        source: SITE_CATALOG_SOURCE,
        urls: SITE_CATALOG.length,
        aliases:
            Array.from(SITE_CATALOG_ALIASES.values())
                .reduce(
                    (sum, aliases) =>
                        sum + aliases.size,
                    0
                ),
        error:
            SITE_CATALOG_ERROR || null
    });
});

app.get("/api/sites/search", (req, res) => {
    const query =
        String(req.query.q || "").trim();

    if (!query) {
        return res.json({
            query: "",
            total: 0,
            items: [],
            matches: []
        });
    }

    const ranked = [];

    for (const entry of getCatalogSearchIndex()) {
        const score =
            scoreCatalogEntry(entry, query);

        if (score === null) {
            continue;
        }

        ranked.push({
            url: entry.url,
            hostname: entry.hostname,
            name: entry.name,
            aliases: entry.aliases,
            score,
            allowed:
                (() => {
                    try {
                        return isAllowedUrl(new URL(entry.url));
                    } catch {
                        return false;
                    }
                })()
        });
    }

    ranked.sort((a, b) => (
        a.score - b.score ||
        Number(b.allowed) - Number(a.allowed) ||
        a.url.length - b.url.length ||
        a.url.localeCompare(b.url)
    ));

    const matches =
        ranked.slice(0, 50);

    res.json({
        query,
        total: ranked.length,
        source: SITE_CATALOG_SOURCE,
        catalogUrls: SITE_CATALOG.length,
        matches,
        items:
            matches.map(item => item.url)
    });
});


/* =========================================================
SCHOOLIO NATIVE AI - GROQ
Text + vision + file attachments.
The private Groq API key stays on Render.
========================================================= */
const GROQ_API_KEY = String(
    process.env.GROQ_API_KEY || ""
).trim();

const AI_MODEL = String(
    process.env.AI_MODEL ||
    "openai/gpt-oss-20b"
).trim();

const AI_VISION_MODEL = String(
    process.env.AI_VISION_MODEL ||
    "qwen/qwen3.8-27b"
).trim();

const AI_MAX_MESSAGES = 14;
const AI_MAX_TOTAL_TEXT = 70000;
const AI_MAX_ATTACHMENT_BYTES =
    5 * 1024 * 1024;
const AI_MAX_IMAGES = 3;
const AI_MAX_ATTACHMENTS_PER_MESSAGE = 6;

const AI_SYSTEM_PROMPTS = {
    assistant:
        "You are Schoolio AI. Talk like a normal helpful person. Be clear, friendly, direct, and conversational. Explain things well when needed, but do not sound robotic or overly formal. Do not announce that you are an AI unless it matters. Avoid excessive headings, bullet spam, emojis, decorative Unicode, fake quotes, or strange formatting. Use simple Markdown only when it genuinely improves readability, and use fenced code blocks for code. Never reveal private chain-of-thought; give concise reasoning summaries instead. If the user attaches an image or file, actually use it in your answer.",
    normal:
        "You are Schoolio AI. Answer naturally, directly, and conversationally. Keep responses clean and easy to read. Avoid excessive Markdown, headings, emojis, decorative symbols, and robotic phrasing. Use code blocks when code is needed. Never reveal private chain-of-thought; provide concise reasoning summaries instead. If the user attaches an image or file, actually use it in your answer."
};

function safeAIFileName(value) {
    return String(value || "attachment")
        .replace(/[\r\n\t]/g, " ")
        .replace(/[<>]/g, "")
        .slice(0, 180);
}

function decodeAIDataUrl(dataUrl) {
    const value =
        String(dataUrl || "");

    const match =
        value.match(
            /^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i
        );

    if (!match) {
        throw new Error(
            "Invalid attachment encoding."
        );
    }

    const mime =
        String(
            match[1] ||
            "application/octet-stream"
        ).toLowerCase();

    const base64 =
        match[2].replace(/\s+/g, "");

    const buffer =
        Buffer.from(base64, "base64");

    if (
        !buffer.length ||
        buffer.length >
            AI_MAX_ATTACHMENT_BYTES
    ) {
        throw new Error(
            "Attachment is empty or too large. Keep each attachment under 5 MB."
        );
    }

    return {
        mime,
        buffer
    };
}

function cleanAIAnswer(value) {
    return String(value || "")
        .replace(
            /<think>[\s\S]*?<\/think>/gi,
            ""
        )
        .replace(
            /^\s*(?:assistant|final answer)\s*:\s*/i,
            ""
        )
        .trim();
}

async function processAIAttachment(
    attachment,
    counters
) {
    const item =
        attachment &&
        typeof attachment === "object"
            ? attachment
            : {};

    const kind =
        String(item.kind || "")
            .toLowerCase();

    const name =
        safeAIFileName(item.name);

    const type =
        String(item.type || "")
            .toLowerCase();

    if (kind === "image") {
        if (
            !/^image\/(?:png|jpeg|webp)$/.test(type)
        ) {
            throw new Error(
                `${name}: only PNG, JPG/JPEG, and WebP images are supported.`
            );
        }

        if (
            counters.images >=
            AI_MAX_IMAGES
        ) {
            throw new Error(
                `A maximum of ${AI_MAX_IMAGES} images can be sent in one AI request.`
            );
        }

        const decoded =
            decodeAIDataUrl(item.data);

        if (
            decoded.mime !== type
        ) {
            throw new Error(
                `${name}: image type does not match its data.`
            );
        }

        counters.images += 1;

        return {
            kind: "image",
            name,
            imagePart: {
                type: "image_url",
                image_url: {
                    url:
                        String(item.data)
                }
            },
            normalized: {
                kind: "image",
                name,
                type,
                data:
                    String(item.data)
            }
        };
    }

    if (kind === "text") {
        const text =
            String(item.text || "")
                .slice(0, 30000);

        if (!text.trim()) {
            throw new Error(
                `${name}: the file did not contain readable text.`
            );
        }

        return {
            kind: "text",
            name,
            text,
            normalized: {
                kind: "text",
                name,
                type:
                    type ||
                    "text/plain",
                text
            }
        };
    }

    if (kind === "document") {
        const decoded =
            decodeAIDataUrl(item.data);

        const ext =
            path.extname(name)
                .toLowerCase();

        let extracted = "";

        if (
            type === "application/pdf" ||
            ext === ".pdf"
        ) {
            if (!pdfParse) {
                throw new Error(
                    `${name}: PDF support is not installed on the server. Deploy the included package.json and run npm install.`
                );
            }

            const parsed =
                await pdfParse(
                    decoded.buffer
                );

            extracted =
                String(
                    parsed &&
                    parsed.text ||
                    ""
                );
        }
        else if (
            type ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            ext === ".docx"
        ) {
            if (!mammoth) {
                throw new Error(
                    `${name}: DOCX support is not installed on the server. Deploy the included package.json and run npm install.`
                );
            }

            const result =
                await mammoth
                    .extractRawText({
                        buffer:
                            decoded.buffer
                    });

            extracted =
                String(
                    result &&
                    result.value ||
                    ""
                );
        }
        else {
            extracted =
                decoded.buffer
                    .toString("utf8");
        }

        extracted =
            extracted
                .replace(/\u0000/g, "")
                .slice(0, 40000);

        if (!extracted.trim()) {
            throw new Error(
                `${name}: no readable text could be extracted from this document.`
            );
        }

        return {
            kind: "text",
            name,
            text: extracted,
            normalized: {
                kind: "text",
                name,
                type:
                    "text/plain",
                text: extracted
            }
        };
    }

    throw new Error(
        `${name}: unsupported attachment type.`
    );
}

async function buildAIMessages(
    incoming
) {
    const counters = {
        images: 0,
        textChars: 0
    };

    const output = [];
    const normalizedLatest = [];

    const source =
        incoming.slice(
            -AI_MAX_MESSAGES
        );

    for (
        let index = 0;
        index < source.length;
        index += 1
    ) {
        const item =
            source[index] &&
            typeof source[index] === "object"
                ? source[index]
                : {};

        const role =
            item.role === "assistant"
                ? "assistant"
                : "user";

        let text =
            String(
                item.content || ""
            ).slice(0, 8000);

        const imageParts = [];

        if (role === "user") {
            const attachments =
                Array.isArray(
                    item.attachments
                )
                    ? item.attachments.slice(
                        0,
                        AI_MAX_ATTACHMENTS_PER_MESSAGE
                    )
                    : [];

            for (
                let attachmentIndex = 0;
                attachmentIndex <
                    attachments.length;
                attachmentIndex += 1
            ) {
                const processed =
                    await processAIAttachment(
                        attachments[
                            attachmentIndex
                        ],
                        counters
                    );

                if (
                    processed.kind ===
                    "image"
                ) {
                    imageParts.push(
                        processed.imagePart
                    );
                }
                else {
                    text +=
                        `\n\n--- Attached file: ${processed.name} ---\n` +
                        processed.text +
                        `\n--- End attached file ---`;
                }

                if (
                    index ===
                    source.length - 1
                ) {
                    normalizedLatest.push(
                        processed.normalized
                    );
                }
            }
        }

        text =
            text.trim();

        if (
            !text &&
            imageParts.length
        ) {
            text =
                "Please analyze the attached image.";
        }

        if (!text) {
            continue;
        }

        counters.textChars +=
            text.length;

        if (
            counters.textChars >
            AI_MAX_TOTAL_TEXT
        ) {
            throw new Error(
                "The conversation and attached files are too large. Clear the chat or attach a smaller file."
            );
        }

        if (
            role === "user" &&
            imageParts.length
        ) {
            output.push({
                role,
                content: [
                    {
                        type: "text",
                        text
                    },
                    ...imageParts
                ]
            });
        }
        else {
            output.push({
                role,
                content: text
            });
        }
    }

    return {
        messages: output,
        hasImages:
            counters.images > 0,
        normalizedLatest
    };
}

app.get("/api/ai/status", (req, res) => {
    res.json({
        configured:
            Boolean(
                GROQ_API_KEY
            ),
        model:
            AI_MODEL,
        visionModel:
            AI_VISION_MODEL,
        provider:
            "Groq",
        endpoint:
            "/api/ai",
        attachments: {
            images: true,
            text: true,
            pdf:
                Boolean(pdfParse),
            docx:
                Boolean(mammoth),
            maxImages:
                AI_MAX_IMAGES,
            maxAttachmentBytes:
                AI_MAX_ATTACHMENT_BYTES
        }
    });
});

app.post("/api/ai", async (req, res) => {
    if (!GROQ_API_KEY) {
        return res
            .status(503)
            .json({
                error:
                    "AI is not configured on Render.",
                setup:
                    "Add GROQ_API_KEY in Render Environment, then redeploy.",
                model:
                    AI_MODEL
            });
    }

    const mode =
        req.body &&
        req.body.mode === "normal"
            ? "normal"
            : "assistant";

    const incoming =
        Array.isArray(
            req.body &&
            req.body.messages
        )
            ? req.body.messages
            : [];

    if (!incoming.length) {
        return res
            .status(400)
            .json({
                error:
                    "No message was provided."
            });
    }

    let built;

    try {
        built =
            await buildAIMessages(
                incoming
            );
    }
    catch (error) {
        return res
            .status(400)
            .json({
                error:
                    String(
                        error &&
                        error.message ||
                        error ||
                        "Could not process the attachment."
                    )
            });
    }

    if (!built.messages.length) {
        return res
            .status(400)
            .json({
                error:
                    "No readable message or attachment was provided."
            });
    }

    const selectedModel =
        built.hasImages
            ? AI_VISION_MODEL
            : AI_MODEL;

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () =>
                controller.abort(),
            90000
        );

    try {
        const response =
            await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Authorization":
                            "Bearer " +
                            GROQ_API_KEY,
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            model:
                                selectedModel,
                            messages: [
                                {
                                    role:
                                        "system",
                                    content:
                                        AI_SYSTEM_PROMPTS[
                                            mode
                                        ]
                                },
                                ...built.messages
                            ],
                            max_completion_tokens:
                                1400,
                            temperature:
                                mode ===
                                "assistant"
                                    ? 0.55
                                    : 0.7,
                            stream:
                                false
                        }),
                    signal:
                        controller.signal
                }
            );

        const raw =
            await response.text();

        let data = null;

        try {
            data =
                JSON.parse(raw);
        }
        catch {}

        if (!response.ok) {
            const providerMessage =
                data &&
                (
                    data.error?.message ||
                    data.error ||
                    data.message
                );

            return res
                .status(
                    response.status
                )
                .json({
                    error:
                        typeof providerMessage ===
                        "string"
                            ? providerMessage
                            : "Groq returned an error.",
                    model:
                        selectedModel
                });
        }

        const content =
            data &&
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0]
                .message.content;

        const answer =
            cleanAIAnswer(
                content
            );

        if (!answer) {
            return res
                .status(502)
                .json({
                    error:
                        "The model returned an empty response.",
                    model:
                        selectedModel
                });
        }

        res.json({
            answer,
            model:
                selectedModel,
            textModel:
                AI_MODEL,
            visionModel:
                AI_VISION_MODEL,
            usedVision:
                built.hasImages,
            normalizedAttachments:
                built.normalizedLatest,
            mode,
            provider:
                "Groq"
        });
    }
    catch (error) {
        res.status(
            error &&
            error.name ===
                "AbortError"
                ? 504
                : 502
        ).json({
            error:
                error &&
                error.name ===
                    "AbortError"
                    ? "The AI request timed out."
                    : "Could not reach Groq.",
            model:
                selectedModel
        });
    }
    finally {
        clearTimeout(
            timeout
        );
    }
});

app.get("/api/check", async (req, res) => {
    const target = req.query.url;

    if (!target) {
        return res.status(400).json({
            allowed: false,
            cataloged: false,
            reason: "missing_url",
            error: "Missing url"
        });
    }

    let normalizedTarget = "";

    try {
        normalizedTarget =
            new URL(
                sanitizeTypedUrl(target) || target
            ).href;
    } catch {}

    const cataloged =
        Boolean(normalizedTarget) &&
        SITE_CATALOG.some(item => {
            try {
                return new URL(item).href === normalizedTarget;
            } catch {
                return false;
            }
        });

    try {
        const url = await validateUrl(target);

        res.json({
            allowed: true,
            cataloged,
            reason: "allowed",
            url: url.href,
            hostname: url.hostname,
            corrected: Boolean(url.schoolioCorrected)
        });
    } catch (error) {
        const message =
            String(error && error.message || "");

        res.status(403).json({
            allowed: false,
            cataloged,
            reason:
                /allowlist/i.test(message)
                    ? "not_proxy_approved"
                    : "validation_error",
            error: message
        });
    }
});

app.get("/blocked", (req, res) => {
    const attempted = String(req.query.url || "");

    res.status(403)
        .type("html")
        .send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Blocked</title></head>
<body style="font-family:Arial;background:#070707;color:#ddd;padding:40px">
<h2 style="color:#ff4458">Site not allowed</h2>
<p>This destination is not in the Schoolio proxy allowlist.</p>
<code>${escapeHtml(attempted)}</code>
</body>
</html>`);
});

app.all("/proxy", async (req, res) => {
    const targetValue = req.query.url;

    if (!targetValue) {
        return res.status(400).json({
            error: "Missing 'url' query parameter"
        });
    }

    try {
        const targetUrl = await validateUrl(targetValue);
        const headers = buildTargetHeaders(req, targetUrl);

        const method = String(req.method || "GET").toUpperCase();

        const options = {
            method,
            headers,
            redirect: "manual"
        };

        if (
            !["GET", "HEAD"].includes(method) &&
            Buffer.isBuffer(req.body) &&
            req.body.length
        ) {
            options.body = req.body;
        }

        const response = await fetch(targetUrl.href, options);

        if (response.status === 404) {
            return res
                .status(404)
                .type("html")
                .send(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Remote Site Returned 404</title>
</head>
<body style="font-family:Arial;background:#070707;color:#ddd;padding:40px">
<h2 style="color:#ff4458">Remote site returned 404</h2>
<p>The URL was found and sent through Schoolio Proxy, but the destination itself says this page does not exist.</p>
<p><strong>Target:</strong></p>
<code style="word-break:break-all">${escapeHtml(targetUrl.href)}</code>
<p style="margin-top:20px;color:#888">This is different from a Schoolio catalog or allowlist error.</p>
</body>
</html>`);
        }

        // Keep redirects inside the proxy and revalidate the next destination.
        if (
            response.status >= 300 &&
            response.status < 400
        ) {
            const location = response.headers.get("location");

            if (!location) {
                return res
                    .status(response.status)
                    .send("Redirect has no destination");
            }

            const next = new URL(location, targetUrl);
            await validateUrl(next.href);

            const setCookies = getSetCookies(response.headers)
                .map(cookie => rewriteSetCookie(cookie, targetUrl.hostname))
                .filter(Boolean);

            for (const cookie of setCookies) {
                res.append("Set-Cookie", cookie);
            }

            res.status(response.status);
            res.setHeader("Location", proxyUrl(next.href));
            return res.end();
        }

        const setCookies = getSetCookies(response.headers)
            .map(cookie => rewriteSetCookie(cookie, targetUrl.hostname))
            .filter(Boolean);

        for (const cookie of setCookies) {
            res.append("Set-Cookie", cookie);
        }

        res.status(response.status);

        const contentType =
            response.headers.get("content-type") ||
            "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Schoolio-Final-URL", targetUrl.href);

        const etag = response.headers.get("etag");
        const lastModified = response.headers.get("last-modified");
        const acceptRanges = response.headers.get("accept-ranges");
        const contentRange = response.headers.get("content-range");

        if (etag) res.setHeader("ETag", etag);
        if (lastModified) res.setHeader("Last-Modified", lastModified);
        if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
        if (contentRange) res.setHeader("Content-Range", contentRange);

        if (
            method === "HEAD" ||
            response.status === 204 ||
            response.status === 304
        ) {
            return res.end();
        }

        const declaredLength = Number(
            response.headers.get("content-length") || 0
        );

        if (
            declaredLength &&
            declaredLength > MAX_RESPONSE_BYTES
        ) {
            return res
                .status(413)
                .send("Response is too large");
        }

        const buffer = Buffer.from(
            await response.arrayBuffer()
        );

        if (buffer.length > MAX_RESPONSE_BYTES) {
            return res
                .status(413)
                .send("Response is too large");
        }

        if (contentType.includes("text/html")) {
            res.setHeader("Cache-Control", "no-store");
            return res
                .type("html")
                .send(
                    rewriteHtml(
                        buffer.toString("utf8"),
                        targetUrl.href
                    )
                );
        }

        if (contentType.includes("text/css")) {
            res.setHeader("Cache-Control", "public, max-age=120");
            return res
                .type("css")
                .send(
                    rewriteCss(
                        buffer.toString("utf8"),
                        targetUrl.href
                    )
                );
        }

        if (
            contentType.includes("javascript") ||
            contentType.includes("ecmascript")
        ) {
            res.setHeader("Cache-Control", "public, max-age=120");
            return res.send(
                Buffer.from(
                    rewriteJavaScript(
                        buffer.toString("utf8"),
                        targetUrl.href
                    ),
                    "utf8"
                )
            );
        }

        if (
            /^image\//i.test(contentType) ||
            /^font\//i.test(contentType) ||
            /woff|font|octet-stream/i.test(contentType)
        ) {
            res.setHeader("Cache-Control", "public, max-age=600");
        } else {
            res.setHeader("Cache-Control", "public, max-age=120");
        }

        return res.send(buffer);
    } catch (error) {
        res.status(403)
            .type("html")
            .send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Schoolio Proxy Error</title></head>
<body style="font-family:Arial;background:#070707;color:#ddd;padding:40px">
<h2 style="color:#ff4458">Schoolio Proxy Error</h2>
<p>${escapeHtml(error.message)}</p>
</body>
</html>`);
    }
});

app.use((req, res) => {
    res.status(404).json({
        error: "Schoolio route not found"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(VERSION);
    console.log("Port:", PORT);
    console.log("Allowed domains:", ALLOWED_HOSTS.length);
    console.log("Catalog URLs:", SITE_CATALOG.length);
    console.log(
        "Allowed catalog variations:",
        ALLOWED_CATALOG_VARIANTS.length
    );
});