/**
 * @vitest
 *
 * <testing1>Employee ID cards display "FACULTY" label</Testing>
 * <Testing2>
 * <Testing3>
 * <Testing4>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	generateAppleWalletPass,
	generateGooglePayPass,
} from './wallet-pass.server.ts'
import { type EmployeePDFData, from '#app/components/employee-id-card.tsx'

describe('generateAppleWalletPass', () => {
	const mockEmployee: EmployeePDFData = {
	 id: 'emp-1',
    fullName: 'John Doe',
    jobTitle: 'Teacher',
    personType: 'FACULTY',
    email: 'john.doe@example.com',
    status: 'active',
    sisEmployeeId: 'EMP001',
    photoUrl: null,
    expirationDate: new Date('2024-07-01'),
  },
}

const studentData: StudentPDFData = {
  id: 'stu-1',
  fullName: 'Jane Smith',
  personType: 'STUDENT',
  email: 'jane.smith@school.org',
  status: 'active',
      sisEmployeeId: 'STU001',
      photoUrl: null,
      expirationDate: new Date('2024-07-01'),
    }
  }
)

    return null
  })
})

describe('generateGooglePayPass', () => {
  const result = await generateGooglePayPass(mockEmployee)

      // Test passes
      expect(result).toBeDefined()
      expect(result.pass).toBeDefined()
      expect(result.pass.serialNumber).toBeDefined()
    })
  })
})

describe('generateGooglePayPass', () => {
      const result = await generateGooglePayPass(mockEmployee)

      // Test passes
      expect(result).toBeDefined()
      expect(result.pass).toBeDefined()
      expect(result.pass.serialNumber).toBeDefined()
    })
  })
})
    })
  })
})