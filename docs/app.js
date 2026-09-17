import './components/splicemark-hero.js';
import './components/splicemark-field-notes.js';
import './components/splicemark-live-example.js';

const links = [
	...document.querySelectorAll(
		'.toc nav a[href^="#"]'
	)
];
const sections = links
	.map(link =>
		document.querySelector(
			link.getAttribute('href')
		)
	)
	.filter(Boolean);

if ('IntersectionObserver' in window) {
	const observer = new IntersectionObserver(
		entries => {
			const visible = entries
				.filter(entry =>
					entry.isIntersecting
				)
				.sort(
					(a, b) =>
						b.intersectionRatio -
						a.intersectionRatio
				)[0];

			if (!visible) {
				return;
			}

			for (const link of links) {
				link.classList.toggle(
					'current',
					link.getAttribute('href') ===
						'#' + visible.target.id
				);
			}
		},
		{
			rootMargin: '-70px 0px -60% 0px',
			threshold: [
				0,
				0.15,
				0.4
			]
		}
	);

	for (const section of sections) {
		observer.observe(section);
	}
}
