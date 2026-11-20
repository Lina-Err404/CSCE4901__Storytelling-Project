import styles from "./waitingRoom.module.css";

type Props = { groupId: string };
type Member = { id: string; name: string; isYou?: boolean };

const SLOT_COUNT = 6;

// Placeholder until your teammate's real data is hooked up
const MOCK_MEMBERS: Member[] = [
  { id: "1", name: "Ezra" },
  { id: "2", name: "Alessia", isYou: true },
  { id: "3", name: "Priya" },
];

export default function WaitingRoom({ groupId }: Props) {
  return (
    <main className={styles.page} data-group-id={groupId}>
      <div className={styles.frame} aria-hidden />

      <div className={styles.spread}>
        <section className={`${styles.leaf} ${styles.leafLeft}`}>
          <img src="/assets/Clouds.svg"      alt="" className={`${styles.art} ${styles.clouds}`} />
          <div className={styles.leafBox}>
            <div className={styles.storyCol}>
                <img src="/assets/poster_card.svg" alt="" className={`${styles.art} ${styles.cardArt}`} />
                <img src="/assets/Moons.svg"       alt="" className={`${styles.art} ${styles.moons}`} />
                <img src="/assets/stars.svg"       alt="" className={`${styles.art} ${styles.stars}`} />
                <img src="/assets/Animated_star1.svg" alt="" className={`${styles.art} ${styles.star1}`} />
                <img src="/assets/Animated_star2.svg" alt="" className={`${styles.art} ${styles.star2}`} />
                <img src="/assets/Animated_star3.svg" alt="" className={`${styles.art} ${styles.star3}`} />
            </div>
          </div>
        </section>

        <section className={`${styles.leaf} ${styles.leafRight}`}>
          <div className={styles.leafBox}>
            <div className={styles.rightCol}>
              <header className={styles.heading}>
                <h1 className={styles.headingText}>Waiting for members...</h1>
                <div className={styles.divider} aria-hidden>
                  <img src="/assets/divider_sparkle.svg" alt="" className={styles.dividerArt} />
                </div>
              </header>
                <ul className={styles.members} aria-label="Group members">
                  {Array.from({ length: SLOT_COUNT }, (_, i) => {
                    const m = MOCK_MEMBERS[i];
                    if (!m) {
                      return (
                        <li key={`empty-${i}`} className={`${styles.slot} ${styles.slotEmpty}`} aria-label="Waiting for a member">
                          <span className={styles.qmark} aria-hidden>?</span>
                        </li>
                      );
                    }
                    return (
                        <li
                          key={`member-${m.id}`}
                          className={`${styles.slot} ${styles.slotFilled} ${m.isYou ? styles.slotYou : ""}`}
                        >
                        {m.isYou && <span className={styles.youBadge}>You</span>}
                        <span className={styles.avatar} aria-hidden>{m.name[0].toUpperCase()}</span>
                        <span className={styles.memberName}>{m.name}</span>
                      </li>
                    );
                  })}
                </ul>
              <div className={styles.info}>
                <p className={styles.teacherLine}>
                  <img src="/assets/spark.svg" alt="" aria-hidden className={styles.spark} />
                  Your teacher will start the story soon
                  <img src="/assets/spark.svg" alt="" aria-hidden className={styles.spark} />
                </p>
                <div className={styles.infoRule} aria-hidden />
                <h2 className={styles.howTitle}>How to play</h2>
                <p className={styles.howBody}>
                  Each player adds one sentence at a time.
                  <br />
                  Build on what came before!
                </p>
                <div className={styles.dots} aria-hidden>
                  <span className={`${styles.dot} ${styles.dotOn}`} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className={styles.crease} aria-hidden />
    </main>
  );
}