const projectsData = [
{ id: 1, title: 'Солнечная Энергия "Куат"', type: 'Solar', region: 'KZ', img: 'https://placehold.co/400x250/10B981/FFFFFF?text=Solar+KZ', esg: 'E' },
{ id: 2, title: 'Очистной Комплекс "Таза Су"', type: 'Water', region: 'KZ', img: 'https://placehold.co/400x250/0F4C81/FFFFFF?text=Water+KZ', esg: 'S' },
{ id: 3, title: 'Рециклинг ТБО "Zero Waste"', type: 'Waste', region: 'KZ', img: 'https://placehold.co/400x250/3B82F6/FFFFFF?text=Waste+KZ', esg: 'G' },
{ id: 4, title: 'Агро-IoT Ферма "EcoFarm"', type: 'Solar', region: 'ASIA', img: 'https://placehold.co/400x250/FFC107/FFFFFF?text=Agro+IoT+ASIA', esg: 'E' },
{ id: 5, title: 'Мониторинг Лесов', type: 'Water', region: 'EU', img: 'https://placehold.co/400x250/6C757D/FFFFFF?text=Forest+EU', esg: 'E' },
{ id: 6, title: 'Центр Переработки Пластика', type: 'Waste', region: 'ASIA', img: 'https://placehold.co/400x250/DC3545/FFFFFF?text=Plastic+ASIA', esg: 'S' }
];

$(document).ready(function() {
    (async function() {
        const saved = localStorage.getItem('gevidence_connected_wallet');
        if (saved) {
            $('#ctaMetamaskBtn').hide();
            $('#dashboardBtn').show();
        }
    })();

    $('#ctaMetamaskBtn').on('click', async function() {
        try {
            if (!window.ethereum) {
                alert('MetaMask is not installed!\nPlease install MetaMask from https://metamask.io');
                window.open('https://metamask.io', '_blank');
                return;
            }
            $(this).prop('disabled', true).html('Connecting <i class="fas fa-spinner fa-spin"></i>');
            
            if (typeof ethers === 'undefined') {
                alert('Loading ethers library... please try again');
                $(this).prop('disabled', false).html('<i class="fab fa-ethereum me-2"></i> Connect MetaMask');
                return;
            }
            
            const result = await WalletManager.connectWallet();
            if (result && result.address) {
                $('#ctaMetamaskBtn').hide();
                $('#dashboardBtn').show();
                alert('✓ Wallet connected successfully!\n\nClick "Go to Dashboard" to continue.');
            } else {
                throw new Error('No wallet address returned');
            }
        } catch (error) {
            if (error.code === 4001) {
                alert('You rejected the connection request.');
            } else if (error.message && error.message.includes('MetaMask')) {
                alert('MetaMask Error: ' + error.message);
            } else {
                alert('Failed to connect wallet:\n' + error.message);
            }
            $(this).prop('disabled', false).html('<i class="fab fa-ethereum me-2"></i> Connect MetaMask');
        }
    });

    $('.scroll-link').on('click', function(e) {
        e.preventDefault();
        const target = $(this).attr('href');
        $('html, body').animate({
            scrollTop: $(target).offset().top - $('.navbar').outerHeight()
        }, 800);
    });

    function renderProjectCards(data) {
        const $container = $('#projectList');
        $container.empty();
        if (data.length === 0) {
            $container.html('<p class="text-center w-100">Проекты по заданным критериям не найдены.</p>');
            return;
        }

        data.forEach(project => {
            const esgBadge = project.esg === 'E' ? 'success' : (project.esg === 'S' ? 'primary' : 'info');
            const card = `
                <div class="col project-card-item" data-type="${project.type}" data-region="${project.region}" data-title="${project.title.toLowerCase()}">
                    <div class="card project-card h-100">
                        <img src="${project.img}" class="card-img-top" alt="${project.title}">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title text-ge-blue fw-bold">${project.title}</h5>
                            <p class="card-text">
                                <span class="badge bg-${esgBadge} me-2">ESG Type: ${project.esg}</span>
                                <span class="badge bg-secondary">${project.region}</span>
                            </p>
                            <button class="btn btn-sm btn-outline-ge-green mt-auto view-details-btn" data-bs-toggle="modal" data-bs-target="#projectModal" data-id="${project.id}">
                                <i class="fas fa-eye me-1"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
            $container.append(card);
        });

        $('.view-details-btn').on('click', function() {
            const projectId = $(this).data('id');
            const project = projectsData.find(p => p.id === projectId);
            if (project) {
                $('#projectModalLabel').text(`Детали проекта: ${project.title}`);
            }
        });
    }

    renderProjectCards(projectsData);

    $('#typeFilter, #regionFilter, #searchBar').on('change keyup', function() {
        const type = $('#typeFilter').val();
        const region = $('#regionFilter').val();
        const search = $('#searchBar').val().toLowerCase();

        const filtered = projectsData.filter(project => {
            const matchesType = type === 'Тип проекта' || project.type === type;
            const matchesRegion = region === 'Регион' || project.region === region;
            const matchesSearch = project.title.toLowerCase().includes(search);
            return matchesType && matchesRegion && matchesSearch;
        });

        renderProjectCards(filtered);
    });

    $('#contactForm').on('submit', function(e) {
        e.preventDefault();
        const form = this;
        let isValid = true;
        
        $(form).find('.form-control, .form-select, textarea').removeClass('is-invalid');
        $(form).find('.invalid-feedback').text(''); 
        $('#successMessage').addClass('d-none').hide();
        
        const nameField = $('#contactName');
        const emailField = $('#contactEmail');
        const roleField = $('#contactRole');
        const messageField = $('#contactMessage');
        
        if (!nameField.val()) {
            nameField.addClass('is-invalid');
            nameField.next('.invalid-feedback').text('Пожалуйста, введите Ваше имя.');
            isValid = false;
        } else if (nameField.val().length < 3) {
            nameField.addClass('is-invalid');
            nameField.next('.invalid-feedback').text('Имя должно содержать минимум 3 символа.');
            isValid = false;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailField.val()) {
            emailField.addClass('is-invalid');
            emailField.next('.invalid-feedback').text('Пожалуйста, введите Email.');
            isValid = false;
        } else if (!emailPattern.test(emailField.val())) {
            emailField.addClass('is-invalid');
            emailField.next('.invalid-feedback').text('Введите корректный формат Email (например, name@domain.com).');
            isValid = false;
        }

        if (!roleField.val()) { 
            roleField.addClass('is-invalid');
            roleField.next('.invalid-feedback').text('Пожалуйста, выберите вашу роль.');
            isValid = false;
        }

        if (!messageField.val()) {
            messageField.addClass('is-invalid');
            messageField.next('.invalid-feedback').text('Пожалуйста, напишите сообщение.');
            isValid = false;
        } else if (messageField.val().length < 10) {
            messageField.addClass('is-invalid');
            messageField.next('.invalid-feedback').text('Сообщение должно содержать минимум 10 символов.');
            isValid = false;
        }
        
        if (isValid) {
            $(form).find('.form-control, .form-select, textarea').val(''); 
            $('#successMessage').removeClass('d-none').fadeIn(800); 
        } else {
            $(form).find('.is-invalid').first().focus();
        }
    });

    const $faders = $('.fade-in-on-scroll');

    function checkFaders() {
        const windowHeight = $(window).height();
        $faders.each(function() {
            const elementTop = $(this).offset().top;
            const scrollPosition = $(window).scrollTop();
            
            if (elementTop < scrollPosition + windowHeight * 0.8) {
                $(this).addClass('is-visible');
            }
        });
    }

    checkFaders();
    $(window).on('scroll', checkFaders);

    $('#howItWorksAccordion').on('show.bs.collapse', function (e) {
    });

    const themeToggle = $('#themeToggle');
    const storageKey = 'geEvidenceTheme';
    const darkIcon = 'fa-moon';
    const lightIcon = 'fa-sun';

    function setTheme(theme) {
        if (theme === 'dark') {
            $('body').addClass('dark-mode');
            themeToggle.find('i').removeClass(darkIcon).addClass(lightIcon);
        } else {
            $('body').removeClass('dark-mode');
            themeToggle.find('i').removeClass(lightIcon).addClass(darkIcon);
        }
    }

    const savedTheme = localStorage.getItem(storageKey);

    if (savedTheme) {
        setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
    } else {
        setTheme('light');
    }

    themeToggle.on('click', function() {
        const currentTheme = $('body').hasClass('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem(storageKey, newTheme);
    });
});