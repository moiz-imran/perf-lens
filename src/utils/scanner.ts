import fs from "fs";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

type Framework =
  | 'react'
  | 'next.js'
  | 'vue'
  | 'nuxt'
  | 'astro'
  | 'remix'
  | 'unknown';

interface ProjectInfo {
  framework: Framework;
  version?: string;
  isTypeScript: boolean;
  features: {
    hasTailwind: boolean;
    hasSSR: boolean;
    hasSSG: boolean;
    hasTesting: boolean;
    hasStateManagement: boolean;
    hasRouting: boolean;
    hasStyling: boolean;
  };
}

function detectFramework(packageJson: PackageJson): ProjectInfo {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const info: ProjectInfo = {
    framework: 'unknown',
    isTypeScript: false,
    features: {
      hasTailwind: false,
      hasSSR: false,
      hasSSG: false,
      hasTesting: false,
      hasStateManagement: false,
      hasRouting: false,
      hasStyling: false
    }
  };

  // Detect TypeScript
  info.isTypeScript = !!(
    deps['typescript'] ||
    deps['@types/react'] ||
    deps['@types/vue'] ||
    deps['@types/node']
  );

  // Detect Testing
  info.features.hasTesting = !!(
    deps['jest'] ||
    deps['vitest'] ||
    deps['@testing-library/react'] ||
    deps['@testing-library/vue'] ||
    deps['cypress'] ||
    deps['playwright']
  );

  // Detect State Management
  info.features.hasStateManagement = !!(
    deps['redux'] ||
    deps['@reduxjs/toolkit'] ||
    deps['mobx'] ||
    deps['zustand'] ||
    deps['pinia'] ||
    deps['vuex']
  );

  // Detect Routing
  info.features.hasRouting = !!(
    deps['react-router-dom'] ||
    deps['vue-router'] ||
    deps['@remix-run/router']
  );

  // Detect Styling Solutions
  info.features.hasStyling = !!(
    deps['tailwindcss'] ||
    deps['@emotion/react'] ||
    deps['styled-components'] ||
    deps['sass'] ||
    deps['less'] ||
    deps['@mui/material'] ||
    deps['chakra-ui']
  );

  // Detect Tailwind
  info.features.hasTailwind = !!(
    deps['tailwindcss'] ||
    deps['@nuxtjs/tailwindcss'] ||
    deps['@astrojs/tailwind']
  );

  // Framework Detection with Version
  if (deps['@remix-run/react']) {
    info.framework = 'remix';
    info.version = deps['@remix-run/react'];
    info.features.hasSSR = true;
    info.features.hasRouting = true;
  } else if (deps['next']) {
    info.framework = 'next.js';
    info.version = deps['next'];
    info.features.hasSSR = true;
    info.features.hasSSG = true;
    info.features.hasRouting = true;
  } else if (deps['nuxt']) {
    info.framework = 'nuxt';
    info.version = deps['nuxt'];
    info.features.hasSSR = true;
    info.features.hasSSG = true;
    info.features.hasRouting = true;
  } else if (deps['vue']) {
    info.framework = 'vue';
    info.version = deps['vue'];
    info.features.hasSSR = true;
    info.features.hasRouting = true;
  } else if (deps['astro']) {
    info.framework = 'astro';
    info.version = deps['astro'];
    info.features.hasSSG = true;
  } else if (deps['react']) {
    info.framework = 'react';
    info.version = deps['react'];
    info.features.hasRouting = true;
  }

  return info;
}

function getFrameworkSpecificChecks(projectInfo: ProjectInfo, filePath: string, content: string): string[] {
  const issues: string[] = [];
  const fileName = path.basename(filePath);

  // Common performance patterns across frameworks
  if (content.includes('console.log(')) {
    issues.push(`💡 Console.log found in ${fileName} - Consider removing in production`);
  }

  if (content.includes('setTimeout(') || content.includes('setInterval(')) {
    const hasCleanup = content.includes('clearTimeout(') || content.includes('clearInterval(');
    if (!hasCleanup) {
      issues.push(`⚠️ Timer without cleanup in ${fileName} - Add cleanup to prevent memory leaks`);
    }
  }

  switch (projectInfo.framework) {
    case 'react':
    case 'next.js':
    case 'remix':
      // React ecosystem checks
      if (content.includes('React.useEffect') || content.includes('useEffect(')) {
        // Check for empty dependency arrays
        if (content.includes('useEffect(') && content.includes('}, []')) {
          issues.push(`💡 Empty dependency array in useEffect in ${fileName} - Verify if this should capture any dependencies`);
        }

        // Check for object dependencies
        const hasObjectDeps = /useEffect\([^,]+,\s*\[[^\]]*\{[^\]]*\}[^}]*\]/g.test(content);
        if (hasObjectDeps) {
          issues.push(`⚠️ Object/array dependencies in useEffect in ${fileName} - Use primitive values or useMemo`);
        }

        // Check for cleanup functions
        if (content.includes('useEffect(') && !content.includes('return () =>')) {
          issues.push(`💡 useEffect in ${fileName} might need a cleanup function`);
        }
      }

      // Check for proper event handler naming
      if (content.includes('onClick={') || content.includes('onChange={')) {
        const hasNonHandlerName = /on\w+={(?!handle)[^}]+}/g.test(content);
        if (hasNonHandlerName) {
          issues.push(`💡 Event handler in ${fileName} doesn't follow 'handle' naming convention`);
        }
      }

      // Check for React.memo usage
      if (content.includes('export default function') && !content.includes('React.memo')) {
        const hasProps = /function\s+\w+\s*\(\s*\{[^}]+\}\s*\)/g.test(content);
        if (hasProps) {
          issues.push(`💡 Consider wrapping ${fileName} with React.memo if it's a pure component`);
        }
      }

      // Framework-specific checks
      if (projectInfo.framework === 'next.js') {
        if (content.includes('getServerSideProps') && !content.includes('cache-control')) {
          issues.push(`💡 getServerSideProps in ${fileName} doesn't set cache headers`);
        }

        if (content.includes('Image') && !content.includes('priority=') && content.includes('above-the-fold')) {
          issues.push(`⚠️ Next.js Image in ${fileName} might be above the fold but missing 'priority' prop`);
        }

        if (content.includes('useRouter') && !content.includes('usePathname')) {
          issues.push(`💡 Consider using usePathname instead of useRouter().pathname`);
        }

        if (content.includes('getStaticProps') && !content.includes('revalidate')) {
          issues.push(`💡 Consider adding revalidate to getStaticProps in ${fileName} for ISR`);
        }
      } else if (projectInfo.framework === 'remix') {
        if (content.includes('useLoaderData') && content.includes('useEffect')) {
          issues.push(`💡 Consider using useRevalidator instead of useEffect for data updates`);
        }

        if (content.includes('Form') && !content.includes('replace')) {
          issues.push(`💡 Consider using Form with replace prop in ${fileName}`);
        }

        if (content.includes('useActionData') && !content.includes('useNavigation')) {
          issues.push(`💡 Consider using useNavigation to show loading states in ${fileName}`);
        }
      }
      break;

    case 'vue':
    case 'nuxt':
      // Vue ecosystem checks
      if (content.includes('watch: {') || content.includes('watch(')) {
        const hasDeepWatch = content.includes('deep: true') || content.includes('{ deep: true }');
        if (hasDeepWatch) {
          issues.push(`⚠️ Deep watcher detected in ${fileName} - May impact performance`);
        }

        const hasImmediateWatch = content.includes('immediate: true');
        if (hasImmediateWatch) {
          issues.push(`💡 Consider using onMounted instead of immediate watcher in ${fileName}`);
        }
      }

      if (content.includes('v-for') && !content.includes(':key=')) {
        issues.push(`🚨 v-for directive without key in ${fileName}`);
      }

      // Computed property checks
      if (content.includes('computed: {')) {
        const hasSetterComputed = /computed:\s*{[^}]*set\(/g.test(content);
        if (hasSetterComputed) {
          issues.push(`💡 Computed property with setter in ${fileName} - Consider using methods or watchers`);
        }

        const hasComplexComputed = /computed:\s*{[^}]*if\s*\(/g.test(content);
        if (hasComplexComputed) {
          issues.push(`💡 Complex computed property in ${fileName} - Consider splitting into multiple computed properties`);
        }
      }

      // Nuxt specific checks
      if (projectInfo.framework === 'nuxt') {
        if (content.includes('asyncData(') && !content.includes('$fetchState')) {
          issues.push(`💡 Consider using Nuxt 3's useAsyncData/useFetch in ${fileName}`);
        }

        if (content.includes('useState(') && !content.includes('useNuxtApp')) {
          issues.push(`💡 Consider using useState from Nuxt instead of Vue's useState`);
        }

        if (content.includes('definePageMeta') && !content.includes('ssr: true')) {
          issues.push(`💡 Consider enabling SSR for better SEO in ${fileName}`);
        }
      }
      break;

    case 'astro':
      // Astro specific checks
      if (content.includes('client:load') && content.includes('above-the-fold')) {
        issues.push(`⚠️ Consider using client:visible for below-the-fold components`);
      }

      if (content.includes('getStaticPaths') && !content.includes('fallback')) {
        issues.push(`💡 Consider adding fallback: 'blocking' to getStaticPaths`);
      }

      if (content.includes('import.meta.glob') && !content.includes('eager: true')) {
        issues.push(`💡 Consider using eager: true for critical imports`);
      }

      if (content.includes('client:only') && !content.includes('client:visible')) {
        issues.push(`💡 Consider using client:visible instead of client:only for better performance`);
      }

      if (content.includes('fetch(') && !content.includes('cache: ')) {
        issues.push(`💡 Consider adding cache options to fetch calls in ${fileName}`);
      }
      break;
  }

  // State management checks
  if (projectInfo.features.hasStateManagement) {
    if (content.includes('useState(') && content.length > 1000) {
      issues.push(`💡 Consider using a state management solution for complex state in ${fileName}`);
    }
  }

  // Testing checks
  if (projectInfo.features.hasTesting) {
    if (content.includes('test(') || content.includes('it(')) {
      const hasAsyncTest = /test\([^,]+,\s*async/g.test(content);
      if (hasAsyncTest && !content.includes('await')) {
        issues.push(`💡 Async test without await in ${fileName}`);
      }
    }
  }

  return issues;
}

function scanFile(filePath: string, projectInfo: ProjectInfo): string[] {
  const issues: string[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check file size
  const stats = fs.statSync(filePath);
  if (stats.size > 200 * 1024) {
    issues.push(`🚨 Large File: ${path.basename(filePath)} (${(stats.size / 1024).toFixed(1)} KB) - Consider splitting into smaller components`);
  }

  // Framework-specific checks
  issues.push(...getFrameworkSpecificChecks(projectInfo, filePath, content));

  // General React/Vue checks
  const isComponent = filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || filePath.endsWith('.vue');
  if (isComponent) {
    // Check for inline styles
    if (content.includes('style={{') || content.includes(':style="{')) {
      issues.push(`⚠️ Inline Styles detected in ${path.basename(filePath)} - Consider using CSS classes for better performance`);
    }

    // Check component size
    if (content.length > 5000) {
      issues.push(`⚠️ Large component ${path.basename(filePath)} - Consider splitting into smaller components`);
    }
  }

  // Image optimization checks
  if (content.includes('<img')) {
    const hasOptimizedImage = content.includes('next/image') || content.includes('nuxt-img');
    const hasImgTag = /<img[^>]+src=/g.test(content);
    if (!hasOptimizedImage && hasImgTag) {
      issues.push(`⚠️ Regular <img> tags found in ${path.basename(filePath)} - Consider using ${projectInfo.framework === 'next.js' ? 'next/image' : 'nuxt-img'} for optimization`);
    }
  }

  return issues;
}

function scanDependencies(packageJson: PackageJson, projectInfo: ProjectInfo): string[] {
  const issues: string[] = [];
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Framework-specific package checks
  const heavyPackages: Record<string, string> = {
    // Common heavy packages
    'moment': 'date-fns',
    'lodash': 'lodash-es',
    'jquery': 'modern alternatives',
    'bootstrap': 'tailwindcss',
  };

  // Add framework-specific package checks
  if (projectInfo.framework === 'react' || projectInfo.framework === 'next.js') {
    heavyPackages['@material-ui/core'] = '@mui/material';
    heavyPackages['react-bootstrap'] = '@headlessui/react';
  } else if (projectInfo.framework === 'vue' || projectInfo.framework === 'nuxt') {
    heavyPackages['vuetify'] = 'lighter alternatives like @headlessui/vue';
    heavyPackages['bootstrap-vue'] = 'tailwindcss + @headlessui/vue';
  }

  Object.entries(heavyPackages).forEach(([pkg, alternative]) => {
    if (deps?.[pkg]) {
      issues.push(`⚠️ Heavy package detected: ${pkg} - Consider using ${alternative} for better bundle size`);
    }
  });

  // Check for duplicate functionality
  const duplicates = [
    ['axios', 'got', 'node-fetch', 'isomorphic-fetch'],
    ['lodash', 'underscore', 'ramda'],
    ['styled-components', '@emotion/styled', '@stitches/react']
  ];

  duplicates.forEach(group => {
    const installed = group.filter(pkg => deps?.[pkg]);
    if (installed.length > 1) {
      issues.push(`⚠️ Duplicate functionality: ${installed.join(', ')} - Standardize on one solution`);
    }
  });

  // Framework version checks
  if (projectInfo.version && projectInfo.framework !== 'unknown') {
    const version = projectInfo.version.replace('^', '').replace('~', '');
    const [major] = version.split('.');
    const outdatedVersions = {
      'react': 18,
      'next.js': 13,
      'vue': 3,
      'nuxt': 3
    };
    const outdated = outdatedVersions[projectInfo.framework as keyof typeof outdatedVersions];

    if (outdated && parseInt(major) < outdated) {
      issues.push(`🚨 Outdated ${projectInfo.framework} version (${version}) - Update to version ${outdated}+ for better performance`);
    }
  }

  return issues;
}

async function promptForFramework(): Promise<Framework> {
  console.log(chalk.blue('\n🔍 Let\'s analyze your project!'));
  console.log(chalk.gray('First, let\'s identify your project\'s framework.\n'));

  const { framework } = await inquirer.prompt([
    {
      type: 'list',
      name: 'framework',
      message: chalk.blue('Select your project\'s framework:'),
      choices: [
        {
          name: 'React (SPA)',
          value: 'react',
          description: 'Single Page Application with React'
        },
        {
          name: 'Next.js',
          value: 'next.js',
          description: 'React framework with SSR, SSG, and API routes'
        },
        {
          name: 'Vue.js',
          value: 'vue',
          description: 'Single Page Application with Vue'
        },
        {
          name: 'Nuxt.js',
          value: 'nuxt',
          description: 'Vue framework with SSR, SSG, and API routes'
        },
        {
          name: 'Astro',
          value: 'astro',
          description: 'Static site generator with component islands'
        },
        {
          name: 'Remix',
          value: 'remix',
          description: 'Full-stack React framework with nested routing'
        },
        {
          name: 'Other/Unknown',
          value: 'unknown',
          description: 'Custom setup or other framework'
        }
      ],
      default: 'unknown'
    }
  ]);
  return framework;
}

async function promptForFeatures(projectInfo: ProjectInfo): Promise<ProjectInfo> {
  console.log(chalk.blue('\n📦 Now, let\'s identify your project\'s features'));
  console.log(chalk.gray('Select all the features your project uses:\n'));

  const { features } = await inquirer.prompt<{features: string[]}>([
    {
      type: 'checkbox',
      name: 'features',
      message: chalk.blue('Project Features:'),
      pageSize: 10,
      loop: false,
      choices: [
        {
          name: 'TypeScript',
          value: 'typescript',
          checked: projectInfo.isTypeScript,
          description: 'Using TypeScript for type safety'
        },
        {
          name: 'Tailwind CSS',
          value: 'tailwind',
          checked: projectInfo.features.hasTailwind,
          description: 'Using Tailwind for utility-first CSS'
        },
        {
          name: 'Server-Side Rendering (SSR)',
          value: 'ssr',
          checked: projectInfo.features.hasSSR,
          description: 'Rendering pages on the server'
        },
        {
          name: 'Static Site Generation (SSG)',
          value: 'ssg',
          checked: projectInfo.features.hasSSG,
          description: 'Pre-rendering pages at build time'
        },
        {
          name: 'Testing',
          value: 'testing',
          checked: projectInfo.features.hasTesting,
          description: 'Using Jest, Vitest, or other testing frameworks'
        },
        {
          name: 'State Management',
          value: 'state',
          checked: projectInfo.features.hasStateManagement,
          description: 'Using Redux, Vuex, or other state management'
        },
        {
          name: 'Routing',
          value: 'routing',
          checked: projectInfo.features.hasRouting,
          description: 'Using client-side routing'
        },
        {
          name: 'Styling Solution',
          value: 'styling',
          checked: projectInfo.features.hasStyling,
          description: 'Using CSS-in-JS, SASS, or other styling solutions'
        }
      ]
    }
  ]);

  // Update project info with selected features
  projectInfo.isTypeScript = features.includes('typescript');
  projectInfo.features.hasTailwind = features.includes('tailwind');
  projectInfo.features.hasSSR = features.includes('ssr');
  projectInfo.features.hasSSG = features.includes('ssg');
  projectInfo.features.hasTesting = features.includes('testing');
  projectInfo.features.hasStateManagement = features.includes('state');
  projectInfo.features.hasRouting = features.includes('routing');
  projectInfo.features.hasStyling = features.includes('styling');

  return projectInfo;
}

function findSourceDirectory(): string {
  const cwd = process.cwd();
  const possibleDirs = ['src', 'app', 'pages', 'components'];

  // Check for common source directories
  for (const dir of possibleDirs) {
    const fullPath = path.join(cwd, dir);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // If no standard directories found, look for package.json to verify we're in a project
  const packagePath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error(
      "No package.json found! Please run this command in a JavaScript/TypeScript project root directory."
    );
  }

  // If we found package.json but no source directories, use current directory
  return cwd;
}

async function analyzeFile(filePath: string, projectInfo: ProjectInfo): Promise<string[]> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return getFrameworkSpecificChecks(projectInfo, filePath, content);
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
    return [];
  }
}

async function* findFiles(dir: string): AsyncGenerator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and other common exclude directories
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      yield* findFiles(fullPath);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx|vue|astro)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

export async function analyzeProject(): Promise<string> {
  try {
    // Initial project analysis
    const spinner = ora('Analyzing project structure...').start();
    let packageJson: PackageJson = {};

    try {
      const packageJsonContent = fs.readFileSync('package.json', 'utf-8');
      packageJson = JSON.parse(packageJsonContent);
    } catch (error) {
      spinner.warn('No package.json found, continuing with limited analysis');
    }

    let projectInfo = detectFramework(packageJson);
    spinner.succeed(`Detected ${projectInfo.framework}${projectInfo.version ? ` v${projectInfo.version}` : ''}`);

    // Stop spinner before prompts
    spinner.stop();

    // Framework selection
    if (projectInfo.framework === 'unknown') {
      projectInfo.framework = await promptForFramework();
    } else {
      const { override } = await inquirer.prompt([
        {
          type: 'list',
          name: 'override',
          message: 'Framework Detection',
          choices: [
            { name: `Continue with detected framework (${projectInfo.framework})`, value: false },
            { name: 'Select a different framework', value: true }
          ]
        }
      ]);

      if (override) {
        const { framework } = await inquirer.prompt([
          {
            type: 'list',
            name: 'framework',
            message: 'Select your framework:',
            choices: ['react', 'next.js', 'vue', 'nuxt', 'astro', 'remix']
          }
        ]);
        projectInfo.framework = framework as Framework;
      }
    }

    // Features selection
    projectInfo = await promptForFeatures(projectInfo);

    // Start analysis spinner
    spinner.start('Running static code analysis...');
    const issues: string[] = [];
    let filesAnalyzed = 0;
    const startTime = Date.now();
    const TIMEOUT = 30000; // 30 seconds timeout

    for await (const filePath of findFiles('src')) {
      if (Date.now() - startTime > TIMEOUT) {
        spinner.warn('Analysis taking too long, showing partial results');
        break;
      }

      const fileIssues = await analyzeFile(filePath, projectInfo);
      issues.push(...fileIssues);
      filesAnalyzed++;

      if (filesAnalyzed % 10 === 0) {
        spinner.text = `Analyzed ${filesAnalyzed} files...`;
      }
    }

    // Add dependency analysis
    const dependencyIssues = scanDependencies(packageJson, projectInfo);
    issues.push(...dependencyIssues);

    spinner.succeed(`Analysis complete - ${filesAnalyzed} files checked`);

    if (issues.length === 0) {
      return '✅ No issues found';
    }

    return issues.join('\n');
  } catch (error) {
    console.error('Error during analysis:', error);
    throw new Error('Failed to analyze project');
  }
}