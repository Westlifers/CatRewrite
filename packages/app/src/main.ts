import { createPinia } from "pinia";
import { createApp } from "vue";
import "katex/dist/katex.min.css";
import App from "./App.vue";
import "./style.css";

createApp(App).use(createPinia()).mount("#app");
