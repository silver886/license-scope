import RepoInput from '../components/RepoInput';

const features = [
  {
    title: 'Full Dependency Tree',
    description:
      'Recursively analyzes direct and transitive dependencies to build a complete picture of your project.',
  },
  {
    title: 'License Compatibility',
    description:
      'Evaluates which outbound licenses are compatible with the licenses of all your dependencies.',
  },
  {
    title: 'Multi-Ecosystem Support',
    description:
      'Supports npm, PyPI, Maven, and more. Detects ecosystems automatically from your repository.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center pt-12 pb-4">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">
          LicenseScope
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
          Analyze dependency licenses for any git repository.
          Understand compatibility, identify risks, and ship with confidence.
        </p>

        <RepoInput />
      </section>

      {/* Features */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
