(function bootstrapSpotlight() {
  const mountNode = document.getElementById("react-spotlight");
  if (!mountNode || !window.React || !window.ReactDOM) {
    return;
  }

  const { createElement: h, useEffect, useMemo, useState } = window.React;

    const copy = {
    ru: {
      title: "Выбери свой стиль",
      subtitle: "Выбирай путь и развивайся, а мы поможем найти твою роль.",
      cta: "Подать заявку",
      modes: [
        {
          title: "Строители",
          points: ["Красивые базы и декор", "Планировка и ландшафт", "Проекты для всего сервера"]
        },
        {
          title: "Исследователи",
          points: ["Новые биомы и структуры", "Редкие ресурсы и лут", "Карта приключений"]
        },
        {
          title: "Бойцы и рейды",
          points: ["Сражения с боссами", "Рейды и ивенты", "Совместные вылазки"]
        }
      ]
    },
    ua: {
      title: "Обери свій стиль",
      subtitle: "Обирай шлях і розвивайся, а ми допоможемо знайти твою роль.",
      cta: "Подати заявку",
      modes: [
        {
          title: "Будівельники",
          points: ["Красиві бази й декор", "Планування й ландшафт", "Проекти для всього сервера"]
        },
        {
          title: "Дослідники",
          points: ["Нові біоми й структури", "Рідкісні ресурси й лут", "Карта пригод"]
        },
        {
          title: "Бійці та рейди",
          points: ["Битви з босами", "Рейди й івенти", "Спільні вилазки"]
        }
      ]
    }
  };

  const getLang = () => {
    const saved = localStorage.getItem("Kyora_lang");
    return saved === "ua" ? "ua" : "ru";
  };

  function Spotlight() {
    const [lang, setLang] = useState(getLang());
    const [active, setActive] = useState(0);

    useEffect(() => {
      const handleLang = () => setLang(getLang());
      document.addEventListener("Kyora:language-changed", handleLang);
      return () => document.removeEventListener("Kyora:language-changed", handleLang);
    }, []);

    const data = useMemo(() => copy[lang] || copy.ru, [lang]);
    const current = data.modes[active] || data.modes[0];

    return h("section", { className: "react-spotlight" }, [
      h("h2", { key: "title", className: "react-spotlight-title" }, data.title),
      h("p", { key: "sub", className: "react-spotlight-subtitle" }, data.subtitle),
      h(
        "div",
        { key: "tabs", className: "react-spotlight-tabs", role: "tablist", "aria-label": data.title },
        data.modes.map((mode, index) =>
          h(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": active === index,
              className: active === index ? "is-active" : "",
              onClick: () => setActive(index),
              key: mode.title
            },
            mode.title
          )
        )
      ),
      h(
        "ul",
        { key: "points", className: "react-spotlight-points" },
        current.points.map((point) => h("li", { key: point }, point))
      ),
      h(
        "a",
        { key: "cta", href: "#apply-section", className: "react-spotlight-cta" },
        data.cta
      )
    ]);
  }

  const root = window.ReactDOM.createRoot(mountNode);
  root.render(h(Spotlight));
})();



