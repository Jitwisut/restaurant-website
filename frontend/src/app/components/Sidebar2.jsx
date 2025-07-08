"use client"; // ต้องการ interactivity (เช่น hover) ฝั่ง client

export default function Sidebar() {
  return (
    <aside className="w-96 bg-white p-4 flex flex-col gap-6">
      {/* ——— Logo & Burger ——— */}
      <header className="w-full inline-flex items-center justify-between gap-2.5">
        <a href="#">
          <img
            src="https://pagedone.io/asset/uploads/1701235273.png"
            alt="Pagedone logo"
            className="w-auto h-8"
          />
        </a>

        {/* burger */}
        <button
          type="button"
          className="relative h-6 w-6 bg-white hover:opacity-80"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 6H21M3 12H21M7 18H21"
              stroke="#1F2937"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* ——— Primary Menu ——— */}
      <section className="w-full">
        <div className="h-8 flex items-center px-3">
          <h6 className="text-xs font-semibold text-gray-500">MENU</h6>
        </div>

        <ul className="flex flex-col gap-1">
          {/* 1. Home */}
          <li>
            <a
              href="#"
              className="flex flex-col rounded-lg bg-white p-3 hover:bg-gray-50"
            >
              <div className="flex h-5 items-center gap-3">
                {/* icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                >
                  {/* …path ย่อเพื่อความสั้น… */}
                  <path
                    d="M2.5 5.41667C2.5 3.80584 3.80584 2.5 5.41667 2.5C7.0275 2.5 8.33333 3.80584 8.33333 5.41667C8.33333 7.0275 7.0275 8.33333 5.41667 8.33333C3.80584 8.33333 2.5 7.0275 2.5 5.41667Z"
                    stroke="#6B7280"
                    strokeWidth="1.6"
                  />
                </svg>
                <span className="text-sm font-medium leading-snug text-gray-500">
                  Home
                </span>
              </div>
            </a>
          </li>

          {/* 2. Vote */}
          <li>
            <a
              href="#"
              className="flex flex-col gap-1 rounded-lg bg-white p-3 hover:bg-gray-50"
            >
              <div className="flex h-5 items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                >
                  {/* …path ย่อ… */}
                  <path
                    d="M2.503 9.002A6.479 6.479 0 018.98 2.519"
                    stroke="#6B7280"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-sm font-medium leading-snug text-gray-500">
                  Vote
                </span>
              </div>
            </a>
          </li>

          {/* 3. Upload (มี badge + ลูกศร) */}
          <li>
            <div className="flex flex-col rounded-lg bg-white p-3">
              <div className="inline-flex justify-between">
                <a href="#" className="flex h-5 items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="none"
                  >
                    <path
                      d="M8.147 12.697L10 10.833l1.852 1.864"
                      stroke="#6B7280"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-sm font-medium leading-snug text-gray-500">
                    Upload
                  </span>
                </a>

                <a href="#" className="flex items-center gap-3">
                  <span className="rounded-3xl bg-indigo-100 px-2.5 py-0.5">
                    <span className="text-xs font-medium text-indigo-600">
                      12
                    </span>
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="#6B7280"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </li>

          {/* …ซ่อนเมนู Packs / Store / Livestream / Tickets เพื่อย่อโค้ด… */}
        </ul>
      </section>

      {/* ——— Settings ——— */}
      <section className="flex flex-col">
        <div className="h-8 inline-flex items-center px-3">
          <h6 className="text-xs font-semibold text-gray-500">SETTINGS</h6>
        </div>

        <ul className="flex flex-col gap-1">
          {/* Profile */}
          <li>
            <a
              href="#"
              className="inline-flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                fill="none"
              >
                {/* …icon path ย่อ… */}
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="#6B7280"
                  strokeWidth="1.6"
                />
              </svg>
              <span className="text-sm font-medium leading-snug text-gray-500">
                Profile
              </span>
            </a>
          </li>

          {/* Blog */}
          <li>
            <a
              href="#"
              className="inline-flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="none"
              >
                {/* …path ย่อ… */}
                <rect
                  x="1.5"
                  y="1.5"
                  width="15"
                  height="15"
                  stroke="#6B7280"
                  strokeWidth="1.6"
                />
              </svg>
              <span className="text-sm font-medium leading-snug text-gray-500">
                Blog
              </span>
            </a>
          </li>

          {/* News (ตัวอย่างย่อ) */}
          <li>
            <a
              href="#"
              className="inline-flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="20"
                  height="20"
                  stroke="#6B7280"
                  strokeWidth="1.6"
                />
              </svg>
              <span className="text-sm font-medium leading-snug text-gray-500">
                News
              </span>
            </a>
          </li>

          {/* Logout */}
          <li>
            <a
              href="#"
              className="inline-flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9.167 17.5H5.833C3.988 17.5 2.5 16.012 2.5 14.167V5.833C2.5 3.988 3.988 2.5 5.833 2.5H9.167"
                  stroke="#6B7280"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M8.228 10h8.889M14.34 6.667l2.744 2.744a.5.5 0 010 .778l-2.744 2.744"
                  stroke="#6B7280"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-medium leading-snug text-gray-500">
                Logout
              </span>
            </a>
          </li>
        </ul>
      </section>
    </aside>
  );
}
