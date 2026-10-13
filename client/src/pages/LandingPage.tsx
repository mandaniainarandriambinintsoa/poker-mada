import { Link } from "react-router-dom";
import "./LandingPage.css";

const features = [
  {
    number: "01",
    title: "Le plaisir du jeu, en direct.",
    description:
      "Retrouvez les sensations du Texas Hold’em : lire le jeu, choisir le bon moment et partager la table avec d’autres joueurs.",
  },
  {
    number: "02",
    title: "Une expérience pensée pour vous.",
    description:
      "Des tables lisibles, des actions claires. Sur mobile comme sur ordinateur, gardez votre attention sur la prochaine main.",
  },
  {
    number: "03",
    title: "Madagascar, autour de la table.",
    description:
      "Un espace pour les passionnés de poker à Madagascar. Retrouvez-vous, échangez et faites vivre le jeu ensemble.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <a className="landing__skip" href="#main">
        Aller au contenu
      </a>
      <header className="landing__header">
        <nav className="landing__nav" aria-label="Navigation principale">
          <Link
            to="/"
            className="landing__brand"
            aria-label="Poker Mada — accueil"
          >
            <span aria-hidden="true">♠</span> Poker Mada
          </Link>
          <div className="landing__sections">
            <a href="#experience">L’expérience</a>
            <a href="#commencer">Comment jouer</a>
          </div>
          <Link to="/login" className="landing__login">
            Se connecter <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="landing__hero" aria-labelledby="hero-title">
          <p className="landing__eyebrow">Le poker. L’esprit malgache.</p>
          <h1 id="hero-title">
            Le jeu nous
            <br />
            <span>rapproche.</span>
          </h1>
          <p className="landing__intro">
            Une table, des rencontres, votre prochaine main.
            <br className="landing__desktop-break" /> Découvrez le poker en
            ligne pensé pour Madagascar.
          </p>
          <div className="landing__actions">
            <Link to="/register" className="landing__button">
              Créer mon compte <span aria-hidden="true">↗</span>
            </Link>
            <a href="#experience" className="landing__text-link">
              Découvrir l’expérience <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="landing__art" aria-hidden="true">
            <div className="landing__halo" />
            <div className="landing__playing-card landing__playing-card--back">
              <span>
                A<small>♠</small>
              </span>
              <b>♠</b>
              <span>
                A<small>♠</small>
              </span>
            </div>
            <div className="landing__playing-card landing__playing-card--front">
              <span>
                A<small>♥</small>
              </span>
              <b>♥</b>
              <span>
                A<small>♥</small>
              </span>
            </div>
            <div className="landing__chip landing__chip--one" />
            <div className="landing__chip landing__chip--two" />
          </div>
          <p className="landing__caption">
            Moins de distractions. Plus de jeu.
          </p>
        </section>

        <section
          id="experience"
          className="landing__experience landing__container"
          aria-labelledby="experience-title"
        >
          <p className="landing__eyebrow">L’expérience Poker Mada</p>
          <h2 id="experience-title">
            Tout commence
            <br />
            par une bonne table.
          </h2>
          <p className="landing__section-intro">
            La stratégie, le plaisir d’une belle main, les échanges.
            <br className="landing__desktop-break" /> Tout ce que vous aimez
            dans le poker, simplement.
          </p>
          <div className="landing__features">
            {features.map((feature) => (
              <article key={feature.number}>
                <span className="landing__number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="commencer"
          className="landing__start"
          aria-labelledby="start-title"
        >
          <div className="landing__container landing__start-grid">
            <div>
              <p className="landing__eyebrow">À vous de jouer</p>
              <h2 id="start-title">
                Votre place
                <br />
                vous attend.
              </h2>
              <p className="landing__section-intro">
                Quelques étapes pour rejoindre le jeu.
                <br />
                Puis, prenez le temps de trouver votre rythme.
              </p>
              <Link to="/register" className="landing__text-link">
                Rejoindre Poker Mada <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <ol className="landing__steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Créez votre compte</h3>
                  <p>
                    Inscrivez-vous avec votre adresse e-mail ou votre compte
                    Google.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Choisissez votre table</h3>
                  <p>
                    Découvrez les tables et sélectionnez celle qui correspond à
                    votre envie de jouer.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Entrez dans le jeu</h3>
                  <p>
                    Prenez place, retrouvez les autres joueurs et jouez votre
                    première main.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="landing__closing" aria-labelledby="closing-title">
          <span className="landing__closing-suit" aria-hidden="true">
            ♠
          </span>
          <h2 id="closing-title">
            Une nouvelle main.
            <br />
            Une nouvelle rencontre.
          </h2>
          <p>Le prochain moment de jeu commence ici.</p>
          <Link to="/register" className="landing__button">
            Créer mon compte <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className="landing__footer landing__container">
        <div>
          <Link to="/" className="landing__brand">
            <span aria-hidden="true">♠</span> Poker Mada
          </Link>
          <p>Le poker, ensemble. À Madagascar.</p>
        </div>
        <div className="landing__footer-meta">
          <p>Réservé aux adultes de 18 ans et plus. Jouez avec modération.</p>
          <p>© {new Date().getFullYear()} Poker Mada</p>
        </div>
      </footer>
    </div>
  );
}
